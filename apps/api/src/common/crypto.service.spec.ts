import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

/** A valid 32-byte key, hex encoded. */
const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

function serviceWith(key: string): CryptoService {
  return new CryptoService({ get: () => key } as unknown as ConfigService);
}

describe('CryptoService', () => {
  const crypto = serviceWith(KEY);

  it('refuses a key that is not 32 bytes', () => {
    expect(() => serviceWith('abc')).toThrow(/32 bytes/);
  });

  describe('encrypt / decrypt', () => {
    it('round-trips a value', () => {
      const encrypted = crypto.encrypt('WVWZZZ1JZXW000123');
      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toContain('WVWZZZ');
      expect(crypto.decrypt(encrypted)).toBe('WVWZZZ1JZXW000123');
    });

    it('passes empty values through as null', () => {
      expect(crypto.encrypt(null)).toBeNull();
      expect(crypto.encrypt(undefined)).toBeNull();
      expect(crypto.encrypt('')).toBeNull();
      expect(crypto.decrypt(null)).toBeNull();
    });

    /**
     * A fresh IV per encryption is what keeps the ciphertext from leaking that
     * two rows hold the same VIN.
     */
    it('produces different ciphertext for the same plaintext', () => {
      const first = crypto.encrypt('SAME VALUE');
      const second = crypto.encrypt('SAME VALUE');
      expect(first).not.toBe(second);
      expect(crypto.decrypt(first)).toBe(crypto.decrypt(second));
    });

    it('tags the format so the key can be rotated later', () => {
      expect(crypto.encrypt('x')?.startsWith('v1.')).toBe(true);
    });

    /** GCM authenticates: a tampered ciphertext must not decrypt. */
    it('rejects tampered ciphertext instead of returning wrong plaintext', () => {
      const encrypted = crypto.encrypt('sensitive') as string;
      const parts = encrypted.split('.');
      const corrupted = [parts[0], parts[1], parts[2], 'AAAA'].join('.');
      expect(crypto.decrypt(corrupted)).toBeNull();
    });

    it('cannot decrypt with a different key', () => {
      const encrypted = crypto.encrypt('sensitive');
      expect(serviceWith(OTHER_KEY).decrypt(encrypted)).toBeNull();
    });

    it('returns null for malformed input rather than throwing', () => {
      expect(crypto.decrypt('not-encrypted')).toBeNull();
      expect(crypto.decrypt('v9.a.b.c')).toBeNull();
    });

    /**
     * Deliberately spans one, two, three and four byte UTF-8 sequences: ASCII,
     * a Latin-1 umlaut, CJK ideographs, an em dash, and an astral-plane
     * codepoint that JavaScript stores as a surrogate pair. A naive byte-length
     * or `.charAt` based implementation round-trips the first three and
     * corrupts the last, so the four-byte case is the one that earns its place.
     */
    it('round-trips multi-byte and astral-plane characters', () => {
      const value = 'Müller — 車両 — 🚗';
      expect(crypto.decrypt(crypto.encrypt(value))).toBe(value);
    });
  });

  describe('fingerprint', () => {
    it('is stable for the same input, so it can be indexed', () => {
      expect(crypto.fingerprint('WVWZZZ1JZXW000123')).toBe(crypto.fingerprint('WVWZZZ1JZXW000123'));
    });

    /** Users type VINs inconsistently; lookup must still match. */
    it('normalises case and surrounding whitespace', () => {
      expect(crypto.fingerprint('  wvwzzz1jzxw000123  ')).toBe(
        crypto.fingerprint('WVWZZZ1JZXW000123'),
      );
    });

    it('differs for different inputs', () => {
      expect(crypto.fingerprint('AAA')).not.toBe(crypto.fingerprint('BBB'));
    });

    it('is not reversible to the plaintext', () => {
      expect(crypto.fingerprint('WVWZZZ1JZXW000123')).not.toContain('WVW');
    });

    it('is empty-safe', () => {
      expect(crypto.fingerprint(null)).toBeNull();
      expect(crypto.fingerprint('')).toBeNull();
    });
  });

  describe('token hashing', () => {
    it('is deterministic, so a presented token can be looked up', () => {
      expect(crypto.hashToken('refresh-token')).toBe(crypto.hashToken('refresh-token'));
    });

    it('does not reveal the token', () => {
      expect(crypto.hashToken('refresh-token')).not.toContain('refresh-token');
    });
  });

  describe('safeEquals', () => {
    it('matches identical strings', () => {
      expect(crypto.safeEquals('abc', 'abc')).toBe(true);
    });

    it('rejects different strings and different lengths', () => {
      expect(crypto.safeEquals('abc', 'abd')).toBe(false);
      expect(crypto.safeEquals('abc', 'abcd')).toBe(false);
    });
  });
});
