import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  deviceId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Expiry is enforced, not ignored. Long-lived access tokens are what turn
      // a single leaked token into permanent account access.
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') ?? '',
    });
  }

  /**
   * Confirm the token's subject is still a live account.
   *
   * A signature check alone would keep honouring tokens belonging to a deleted
   * account until they expired. The lookup is a single indexed primary-key read
   * and worth it.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('That session is no longer valid.');
    }

    return {
      userId: user.id,
      email: user.email,
      ...(payload.deviceId ? { deviceId: payload.deviceId } : {}),
    };
  }
}
