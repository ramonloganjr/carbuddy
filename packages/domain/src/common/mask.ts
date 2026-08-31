/**
 * Masking for identifiers that are sensitive but still need to be recognisable
 * at a glance. The rule throughout the product: show enough to confirm "yes,
 * that's my car", never enough to be useful to someone reading over a shoulder.
 */

export type MaskableField =
  'vin' | 'plate' | 'engineNumber' | 'registration' | 'policy' | 'generic';

const VISIBLE_TAIL: Readonly<Record<MaskableField, number>> = {
  vin: 6,
  plate: 3,
  engineNumber: 4,
  registration: 4,
  policy: 4,
  generic: 4,
};

/**
 * Mask all but the trailing characters. Whitespace and dashes are preserved so
 * the shape of a plate or policy number stays readable.
 */
export function maskIdentifier(
  value: string | null | undefined,
  field: MaskableField = 'generic',
  maskChar = '•',
): string {
  if (!value) return '';
  const trimmed = value.trim();
  const tail = VISIBLE_TAIL[field];
  const alphanumericCount = trimmed.replace(/[^A-Za-z0-9]/g, '').length;
  if (alphanumericCount <= tail) return trimmed;

  let remainingToMask = alphanumericCount - tail;
  let out = '';
  for (const ch of trimmed) {
    if (/[A-Za-z0-9]/.test(ch) && remainingToMask > 0) {
      out += maskChar;
      remainingToMask -= 1;
    } else {
      out += ch;
    }
  }
  return out;
}

/** A 17-character VIN split into readable groups: `WVW ZZZ 1JZ XW000001`. */
export function formatVin(vin: string): string {
  const clean = vin.replace(/\s/g, '').toUpperCase();
  if (clean.length !== 17) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
}

/**
 * ISO-3779 VIN check-digit validation. Position 9 is a checksum over the other
 * 16 characters — this catches the great majority of transcription mistakes.
 * Not all markets follow it (notably some non-North-American vehicles), so the
 * UI treats a failure as a warning to confirm, never as a hard rejection.
 */
const VIN_TRANSLITERATION: Readonly<Record<string, number>> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
};

const VIN_POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export type VinValidation =
  { valid: true } | { valid: false; reason: 'length' | 'characters' | 'checksum' };

export function validateVin(vin: string): VinValidation {
  const clean = vin.replace(/\s|-/g, '').toUpperCase();
  if (clean.length !== 17) return { valid: false, reason: 'length' };
  // I, O and Q are excluded from the VIN alphabet to avoid 1/0 confusion.
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return { valid: false, reason: 'characters' };

  let total = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = clean[i] as string;
    total += (VIN_TRANSLITERATION[ch] ?? 0) * (VIN_POSITION_WEIGHTS[i] ?? 0);
  }
  const remainder = total % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  return clean[8] === expected ? { valid: true } : { valid: false, reason: 'checksum' };
}
