import { parseDuration } from './auth.service';

describe('parseDuration', () => {
  it('parses each supported unit', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('60d')).toBe(5_184_000_000);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDuration(' 15m ')).toBe(900_000);
  });

  /**
   * A malformed TTL must not produce a token that never expires. Falling back
   * to 15 minutes fails safe.
   */
  it('falls back to 15 minutes for anything unparseable', () => {
    expect(parseDuration('forever')).toBe(900_000);
    expect(parseDuration('')).toBe(900_000);
    expect(parseDuration('10y')).toBe(900_000);
  });
});
