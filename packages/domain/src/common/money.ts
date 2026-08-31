import type { CurrencyCode, Money } from './types.js';
import { round } from './types.js';

/**
 * Currencies whose smallest unit is not 1/100. Anything absent from this map
 * is treated as 2-decimal, which covers the overwhelming majority of ISO-4217.
 */
const EXPONENT_OVERRIDES: Readonly<Record<string, number>> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

export function currencyExponent(currency: CurrencyCode): number {
  return EXPONENT_OVERRIDES[currency.toUpperCase()] ?? 2;
}

/** Human decimal amount -> integer minor units. `12.34 USD` -> `1234`. */
export function toMinorUnits(amount: number, currency: CurrencyCode): Money {
  const factor = 10 ** currencyExponent(currency);
  return Math.round(amount * factor);
}

/** Integer minor units -> human decimal amount. `1234 USD` -> `12.34`. */
export function fromMinorUnits(minor: Money, currency: CurrencyCode): number {
  const factor = 10 ** currencyExponent(currency);
  return minor / factor;
}

export function addMoney(...amounts: readonly Money[]): Money {
  return amounts.reduce((acc, v) => acc + v, 0);
}

/**
 * Multiply money by a ratio. Half-up rounding keeps totals reproducible across
 * client and server, which matters because both compute the same summaries and
 * compare them during sync.
 */
export function multiplyMoney(amount: Money, factor: number): Money {
  return Math.round(amount * factor);
}

export function divideMoney(amount: Money, divisor: number): Money {
  if (divisor === 0) return 0;
  return Math.round(amount / divisor);
}

/**
 * Split `amount` into `parts` shares that sum exactly back to `amount`.
 * Remainder minor units go to the leading shares so nothing is lost.
 */
export function allocateMoney(amount: Money, parts: number): Money[] {
  if (parts <= 0) return [];
  const base = Math.trunc(amount / parts);
  const remainder = amount - base * parts;
  const sign = Math.sign(remainder) || 1;
  return Array.from({ length: parts }, (_, i) => base + (i < Math.abs(remainder) ? sign : 0));
}

/** Percentage of the whole, as a rounded human-readable number. */
export function percentageOf(part: Money, whole: Money, decimals = 1): number {
  if (whole === 0) return 0;
  return round((part / whole) * 100, decimals);
}

export interface MoneyFormatOptions {
  currency: CurrencyCode;
  locale?: string;
  /** Drop the fractional part — for dense chart axes and summary tiles. */
  compact?: boolean;
  /** `$1.2K` / `$1.4M` style. */
  notation?: 'standard' | 'compact';
}

export function formatMoney(minor: Money, options: MoneyFormatOptions): string {
  const { currency, locale, compact = false, notation = 'standard' } = options;
  const exponent = currencyExponent(currency);
  const value = fromMinorUnits(minor, currency);
  const digits = compact ? 0 : exponent;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      notation,
    }).format(value);
  } catch {
    // Unknown or custom currency code — render the code alongside the number.
    return `${currency} ${value.toFixed(digits)}`;
  }
}
