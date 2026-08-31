/**
 * Shared primitives for the CarBuddy domain layer.
 *
 * Two canonical-storage rules hold everywhere below the presentation layer:
 *   1. Distances are kilometres, volumes are litres. Imperial input is
 *      converted at the edge, never carried through the domain.
 *   2. Money is an integer count of minor units (cents, fils, pence...) so
 *      that summing thousands of records never accumulates float drift.
 */

/** Integer minor currency units. 1234 in USD is $12.34. */
export type Money = number;

/** ISO-4217 code, e.g. `USD`, `EUR`, `PHP`. */
export type CurrencyCode = string;

/** ISO-8601 instant, always stored in UTC. */
export type IsoDateTime = string;

export type Kilometres = number;
export type Litres = number;

export type UUID = string;

/** Result of a calculation that is allowed to be "not computable yet". */
export type Computed<T> = { ok: true; value: T } | { ok: false; reason: string };

export const computed = <T>(value: T): Computed<T> => ({ ok: true, value });
export const notComputable = <T>(reason: string): Computed<T> => ({ ok: false, reason });

/** Narrowing helper so callers can `.filter(isOk)` a list of computations. */
export const isOk = <T>(c: Computed<T>): c is { ok: true; value: T } => c.ok;

/** Unwrap with a fallback — for display paths that must always render something. */
export const valueOr = <T>(c: Computed<T>, fallback: T): T => (c.ok ? c.value : fallback);

export const MS_PER_DAY = 86_400_000;

/** Whole days between two instants; negative when `b` precedes `a`. */
export function daysBetween(a: IsoDateTime | Date, b: IsoDateTime | Date): number {
  const start = a instanceof Date ? a : new Date(a);
  const end = b instanceof Date ? b : new Date(b);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Calendar-aware month arithmetic. Clamps to the last valid day so that
 * "6 months after 31 Aug" is 28/29 Feb rather than rolling into March.
 */
export function addMonths(date: IsoDateTime | Date, months: number): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth));
  return d;
}

export function addDays(date: IsoDateTime | Date, days: number): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  d.setTime(d.getTime() + days * MS_PER_DAY);
  return d;
}

/** `YYYY-MM` bucket key in UTC — the unit every monthly rollup groups on. */
export function monthKey(date: IsoDateTime | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function yearKey(date: IsoDateTime | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return String(d.getUTCFullYear());
}

/** Round to `decimals` places, avoiding the 1.005 -> 1.00 float surprise. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

/** Median over a copy — the input array is never mutated. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * Median absolute deviation, scaled to be a consistent estimator of sigma for
 * normal data. Used instead of standard deviation because a single tow-truck
 * ride or a mis-typed odometer should not move the baseline.
 */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - m)));
}

/** Percentage change from `from` to `to`; `null` when `from` is zero. */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

/** Stable group-by that preserves first-seen key order. */
export function groupBy<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  return out;
}
