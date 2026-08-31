import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Application-level encryption for the few columns that need it.
 *
 * VINs, engine numbers and document numbers are encrypted before they reach
 * PostgreSQL. Database-level encryption at rest protects against a stolen disk;
 * it does nothing about a leaked backup, an over-broad read replica grant, or
 * an SQL injection that returns rows. These particular fields identify a
 * physical vehicle and its registered keeper, so they get a second layer.
 *
 * AES-256-GCM is used rather than CBC because it authenticates as well as
 * encrypts: tampering with a stored ciphertext produces a decryption failure
 * instead of silently different plaintext.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const hex = configService.get<string>('fieldEncryptionKey') ?? '';
    this.key = Buffer.from(hex, 'hex');
    if (this.key.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
  }

  /**
   * Encrypt a value. Output is `v1.<iv>.<tag>.<ciphertext>`, all base64url.
   *
   * The version prefix exists so the key can be rotated later: new writes use
   * `v2`, and `decrypt` keeps understanding `v1` until everything is migrated.
   * Retrofitting a format marker onto opaque ciphertext is not possible.
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') return null;

    // 96-bit IV is the GCM-recommended size and must never repeat for a key.
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(encoded: string | null | undefined): string | null {
    if (!encoded) return null;

    const [version, ivPart, tagPart, dataPart] = encoded.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !dataPart) return null;

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Wrong key or tampered ciphertext. Returning null rather than throwing
      // keeps one bad row from taking down a whole list response.
      return null;
    }
  }

  /**
   * Deterministic fingerprint for equality search.
   *
   * GCM ciphertext is randomised, so two encryptions of the same VIN differ and
   * `WHERE vin = ?` cannot work. An HMAC gives a stable, non-reversible value to
   * index on — enough to answer "do I already have this vehicle?" without
   * decrypting every row. Note the trade-off: identical inputs produce identical
   * fingerprints, which is exactly what makes lookup possible and also means the
   * fingerprint leaks equality. That is acceptable here and would not be for
   * something like a password.
   */
  fingerprint(value: string | null | undefined): string | null {
    if (!value) return null;
    return createHmac('sha256', this.key).update(value.trim().toUpperCase()).digest('base64url');
  }

  /** Hash a refresh token for storage. */
  hashToken(token: string): string {
    return createHmac('sha256', this.key).update(token).digest('base64url');
  }

  /** Constant-time comparison, to avoid leaking a match through timing. */
  safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }
}
