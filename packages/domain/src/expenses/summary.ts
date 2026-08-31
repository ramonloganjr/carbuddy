import {
  daysBetween,
  groupBy,
  monthKey,
  round,
  yearKey,
  type CurrencyCode,
  type IsoDateTime,
  type Kilometres,
  type Money,
} from '../common/types.js';
import { percentageOf } from '../common/money.js';
import type { Expense, ExpenseCategory } from './types.js';

export interface CategoryTotal {
  readonly category: ExpenseCategory;
  readonly total: Money;
  readonly count: number;
  /** Share of the period's spend, 0–100. */
  readonly share: number;
}

export interface PeriodTotal {
  /** `YYYY-MM` for months, `YYYY` for years. */
  readonly period: string;
  readonly total: Money;
  readonly count: number;
  readonly byCategory: readonly CategoryTotal[];
}

export interface ExpenseSummary {
  readonly total: Money;
  readonly currency: CurrencyCode;
  readonly count: number;
  readonly byCategory: readonly CategoryTotal[];
  readonly byMonth: readonly PeriodTotal[];
  readonly byYear: readonly PeriodTotal[];
  readonly firstExpenseAt: IsoDateTime | null;
  readonly lastExpenseAt: IsoDateTime | null;
  /** Calendar months the log actually spans; at least 1. */
  readonly monthsCovered: number;
  readonly averagePerMonth: Money;
  readonly highestMonth: PeriodTotal | null;
  readonly lowestMonth: PeriodTotal | null;
  /** Fuel as a share of everything, 0–100 — a headline analytics figure. */
  readonly fuelSharePercent: number;
  readonly maintenanceSharePercent: number;
}

function totalsByCategory(expenses: readonly Expense[], grandTotal: Money): CategoryTotal[] {
  const grouped = groupBy(expenses, (e) => e.category);
  return [...grouped.entries()]
    .map(([category, items]) => {
      const total = items.reduce((acc, e) => acc + e.amount, 0);
      return {
        category,
        total,
        count: items.length,
        share: percentageOf(total, grandTotal),
      };
    })
    .sort((a, b) => b.total - a.total);
}

function totalsByPeriod(
  expenses: readonly Expense[],
  keyOf: (d: IsoDateTime) => string,
): PeriodTotal[] {
  const grouped = groupBy(expenses, (e) => keyOf(e.incurredAt));
  return [...grouped.entries()]
    .map(([period, items]) => {
      const total = items.reduce((acc, e) => acc + e.amount, 0);
      return { period, total, count: items.length, byCategory: totalsByCategory(items, total) };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

const EMPTY_SUMMARY: Omit<ExpenseSummary, 'currency'> = {
  total: 0,
  count: 0,
  byCategory: [],
  byMonth: [],
  byYear: [],
  firstExpenseAt: null,
  lastExpenseAt: null,
  monthsCovered: 1,
  averagePerMonth: 0,
  highestMonth: null,
  lowestMonth: null,
  fuelSharePercent: 0,
  maintenanceSharePercent: 0,
};

/**
 * Roll expenses up into the ownership-cost picture.
 *
 * `averagePerMonth` divides by the number of months the log *spans*, not by the
 * number of months that happen to contain a receipt. A user who logged nothing
 * in February did not spend nothing that year — treating gaps as real zeroes is
 * what keeps the average honest rather than flatteringly low.
 */
export function summariseExpenses(
  expenses: readonly Expense[],
  fallbackCurrency: CurrencyCode = 'USD',
): ExpenseSummary {
  if (expenses.length === 0) return { ...EMPTY_SUMMARY, currency: fallbackCurrency };

  const sorted = [...expenses].sort(
    (a, b) => new Date(a.incurredAt).getTime() - new Date(b.incurredAt).getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const total = sorted.reduce((acc, e) => acc + e.amount, 0);

  const byMonth = totalsByPeriod(sorted, monthKey);
  const byYear = totalsByPeriod(sorted, yearKey);
  const byCategory = totalsByCategory(sorted, total);

  const spanDays = first && last ? Math.max(0, daysBetween(first.incurredAt, last.incurredAt)) : 0;
  const monthsCovered = Math.max(1, Math.round(spanDays / 30.44) || 1);

  const fuelTotal = byCategory.find((c) => c.category === 'fuel')?.total ?? 0;
  const maintenanceTotal =
    (byCategory.find((c) => c.category === 'maintenance')?.total ?? 0) +
    (byCategory.find((c) => c.category === 'repair')?.total ?? 0);

  const ranked = [...byMonth].sort((a, b) => b.total - a.total);

  return {
    total,
    currency: first?.currency ?? fallbackCurrency,
    count: sorted.length,
    byCategory,
    byMonth,
    byYear,
    firstExpenseAt: first?.incurredAt ?? null,
    lastExpenseAt: last?.incurredAt ?? null,
    monthsCovered,
    averagePerMonth: Math.round(total / monthsCovered),
    highestMonth: ranked[0] ?? null,
    lowestMonth: ranked[ranked.length - 1] ?? null,
    fuelSharePercent: percentageOf(fuelTotal, total),
    maintenanceSharePercent: percentageOf(maintenanceTotal, total),
  };
}

/** Filter to a half-open window `[from, to)`. */
export function expensesInRange(
  expenses: readonly Expense[],
  from: IsoDateTime | Date,
  to: IsoDateTime | Date,
): Expense[] {
  const start = (from instanceof Date ? from : new Date(from)).getTime();
  const end = (to instanceof Date ? to : new Date(to)).getTime();
  return expenses.filter((e) => {
    const t = new Date(e.incurredAt).getTime();
    return t >= start && t < end;
  });
}

export interface CostPerDistance {
  readonly costPerKm: Money | null;
  readonly distanceKm: Kilometres;
  readonly total: Money;
}

/**
 * Cost per kilometre over a known distance.
 *
 * Returns `null` rather than 0 when the distance is unknown. A displayed
 * "$0.00/km" would read as "this car is free to run", which is the opposite of
 * "we don't know yet" — and the empty state says the latter explicitly.
 */
export function costPerDistance(
  expenses: readonly Expense[],
  distanceKm: Kilometres,
): CostPerDistance {
  const total = expenses.reduce((acc, e) => acc + e.amount, 0);
  return {
    total,
    distanceKm,
    costPerKm: distanceKm > 0 ? total / distanceKm : null,
  };
}

/**
 * Month-over-month change for the trend indicator on the dashboard.
 * `null` when there is no prior month to compare against.
 */
export function monthOverMonthChange(byMonth: readonly PeriodTotal[]): number | null {
  if (byMonth.length < 2) return null;
  const current = byMonth[byMonth.length - 1];
  const previous = byMonth[byMonth.length - 2];
  if (!current || !previous || previous.total === 0) return null;
  return round(((current.total - previous.total) / previous.total) * 100, 1);
}
