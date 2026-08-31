import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { defaultPreferences } from '@carbuddy/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto.service';
import type { AuthTokensResponse, SignInDto, SignUpDto } from './dto';

/**
 * Argon2id parameters.
 *
 * Argon2id is the current password-hashing recommendation: it resists both GPU
 * cracking (memory-hard) and side-channel attacks (the `id` hybrid). 19 MiB
 * with two iterations follows the OWASP baseline — enough to make offline
 * cracking expensive, low enough that a burst of sign-ins does not exhaust
 * server memory.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Lockout after this many consecutive failures. */
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  async signUp(dto: SignUpDto, context: RequestContext): Promise<AuthTokensResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Deliberately the same shape as a normal conflict, and deliberately not
      // "that email is taken" on a *sign-in* path — see `signIn` below.
      throw new ForbiddenException('An account with that email already exists.');
    }

    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const userId = randomUUID();

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        preferences: {
          create: toPreferencesRow(userId),
        },
      },
    });

    await this.audit(user.id, 'auth.sign_up', context);
    return this.issueTokens(user.id, user.email, dto.deviceId, context);
  }

  /**
   * Verify credentials and issue tokens.
   *
   * Two anti-enumeration measures matter here:
   *   - The same error is returned whether the email is unknown or the password
   *     is wrong, so the endpoint cannot be used to discover who has an account.
   *   - When the email is unknown, a dummy verification still runs. Without it,
   *     an unknown email returns in ~1 ms and a known one in ~50 ms, and the
   *     timing difference alone leaks the same information the message doesn't.
   */
  async signIn(dto: SignInDto, context: RequestContext): Promise<AuthTokensResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt) {
      await this.burnTime(dto.password);
      throw new UnauthorizedException('Those credentials did not match an account.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Too many failed attempts. Try again in a few minutes.');
    }

    const valid = await verify(user.passwordHash, dto.password).catch(() => false);

    if (!valid) {
      const failedSignInCount = user.failedSignInCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedSignInCount,
          lockedUntil:
            failedSignInCount >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
              : null,
        },
      });
      await this.audit(user.id, 'auth.sign_in_failed', context);
      throw new UnauthorizedException('Those credentials did not match an account.');
    }

    if (user.failedSignInCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedSignInCount: 0, lockedUntil: null },
      });
    }

    await this.audit(user.id, 'auth.sign_in', context);
    return this.issueTokens(user.id, user.email, dto.deviceId, context);
  }

  /**
   * Rotate a refresh token.
   *
   * Every use issues a new token and revokes the old one. If a revoked token is
   * presented again, that means it was captured — the legitimate client would
   * have moved on — so the entire token family is revoked, signing the attacker
   * *and* the victim out rather than letting a thief keep a live session.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<AuthTokensResponse> {
    const tokenHash = this.crypto.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('That session is no longer valid.');

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(stored.userId, 'auth.refresh_reuse_detected', context);
      throw new UnauthorizedException('That session is no longer valid.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('That session has expired. Please sign in again.');
    }

    const tokens = await this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.deviceId ?? undefined,
      context,
      stored.familyId,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return tokens;
  }

  async signOut(userId: string, refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.crypto.hashToken(refreshToken);
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (stored) {
        // Revoke the whole family so every rotated descendant dies too.
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    deviceId: string | undefined,
    context: RequestContext,
    familyId?: string,
  ): Promise<AuthTokensResponse> {
    const accessTtl = this.config.get<string>('jwt.accessTtl') ?? '15m';
    const refreshTtl = this.config.get<string>('jwt.refreshTtl') ?? '60d';
    // Seconds rather than the raw `15m` string: `parseDuration` is already the
    // single place TTL syntax is interpreted, and passing a number keeps the
    // JWT library from re-parsing it under a narrower type.
    const accessTtlSeconds = Math.floor(parseDuration(accessTtl) / 1000);

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, ...(deviceId ? { deviceId } : {}) },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: accessTtlSeconds,
      },
    );

    // The refresh token is opaque random bytes, not a JWT: it carries no claims
    // and is only ever checked against the database, so a leaked signing secret
    // cannot be used to forge one.
    const refreshToken = randomBytes(48).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.crypto.hashToken(refreshToken),
        familyId: familyId ?? randomUUID(),
        deviceId: deviceId ?? null,
        expiresAt: new Date(Date.now() + parseDuration(refreshTtl)),
        userAgent: context.userAgent ?? null,
        ipAddress: context.ipAddress ?? null,
      },
    });

    return {
      userId,
      email,
      accessToken,
      refreshToken,
      expiresIn: accessTtlSeconds,
    };
  }

  /**
   * Spend roughly the time a real verification would, so an unknown email is
   * not distinguishable from a wrong password by response latency.
   */
  private async burnTime(password: string): Promise<void> {
    await hash(password, ARGON2_OPTIONS).catch(() => undefined);
  }

  private async audit(userId: string, action: string, context: RequestContext): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          userId,
          action,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      })
      // Audit logging must never block the user's request.
      .catch((error: unknown) => this.logger.warn(`Audit write failed: ${String(error)}`));
  }
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

function toPreferencesRow(userId: string) {
  const defaults = defaultPreferences({ userId });
  return {
    distanceUnit: defaults.distanceUnit,
    volumeUnit: defaults.volumeUnit,
    economyStandard: defaults.economyStandard,
    pressureUnit: defaults.pressureUnit,
    currency: defaults.currency,
    dateFormat: defaults.dateFormat,
    themeMode: defaults.themeMode,
    dynamicColour: defaults.dynamicColour,
    reduceMotion: defaults.reduceMotion,
    hapticsEnabled: defaults.hapticsEnabled,
    biometricLock: defaults.biometricLockEnabled,
    notifications: defaults.notifications as unknown as object,
  };
}

/** Parse `15m` / `60d` / `3600s` into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return 900_000;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 's':
      return amount * 1_000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return 900_000;
  }
}
