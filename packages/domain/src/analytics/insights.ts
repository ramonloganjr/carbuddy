import { monthKey, type IsoDateTime, type Money } from '../common/types.js';
import type { ExpenseSummary } from '../expenses/summary.js';
import { EXPENSE_CATEGORY_LABEL } from '../expenses/types.js';
import type { FuelStatistics } from '../fuel/statistics.js';
import type { EfficiencyTrend } from '../fuel/statistics.js';
import type { ScheduleEvaluation } from '../maintenance/types.js';

/**
 * An answer to one of the ownership questions the product is built around.
 *
 * Every insight carries its own `question` because that is how it is surfaced
 * in the UI — the analytics screen is a list of questions with answers, not a
 * grid of unlabelled numbers. `value` is pre-formatted by the presentation
 * layer; the domain supplies the raw figure and the sentence around it.
 */
export interface OwnershipInsight {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  /** Raw figure for the UI to format in the user's units and currency. */
  readonly amount?: Money;
  readonly numeric?: number;
  readonly kind: 'money' | 'ratio' | 'trend' | 'date' | 'text';
  readonly emphasis: 'positive' | 'negative' | 'neutral';
  readonly deepLink?: string;
}

export interface InsightInput {
  readonly now: IsoDateTime | Date;
  readonly vehicleId: string;
  readonly expenses: ExpenseSummary;
  readonly fuel: FuelStatistics;
  readonly efficiencyTrend: EfficiencyTrend;
  readonly schedules: readonly ScheduleEvaluation[];
  readonly totalDistanceKm: number;
}

/**
 * Build the answers to the practical questions an owner actually asks.
 *
 * Each generator returns `null` when it lacks the data to answer honestly.
 * Filling gaps with zeroes would produce confident nonsense — "$0.00 per km" —
 * so an unanswerable question is simply not shown, and the screen's empty state
 * explains what to log to unlock it.
 */
export function buildOwnershipInsights(input: InsightInput): OwnershipInsight[] {
  const now = input.now instanceof Date ? input.now : new Date(input.now);
  const currentYear = now.getUTCFullYear();

  const insights: (OwnershipInsight | null)[] = [
    spendThisYear(input, currentYear),
    averageMonthly(input),
    costPerKilometre(input),
    fuelShare(input),
    efficiencyDirection(input),
    priciestMonth(input),
    maintenanceSpend(input),
    nextMajorService(input),
  ];

  return insights.filter((i): i is OwnershipInsight => i !== null);
}

function spendThisYear(input: InsightInput, year: number): OwnershipInsight | null {
  const bucket = input.expenses.byYear.find((y) => y.period === String(year));
  if (!bucket) return null;
  return {
    id: 'spend_this_year',
    question: `How much have I spent this year?`,
    answer: `${bucket.count} record${bucket.count === 1 ? '' : 's'} logged in ${year}.`,
    amount: bucket.total,
    kind: 'money',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/expenses?year=${year}`,
  };
}

function averageMonthly(input: InsightInput): OwnershipInsight | null {
  if (input.expenses.count === 0) return null;
  return {
    id: 'average_monthly',
    question: 'What does this car cost me per month?',
    answer: `Averaged over ${input.expenses.monthsCovered} month${input.expenses.monthsCovered === 1 ? '' : 's'} of records.`,
    amount: input.expenses.averagePerMonth,
    kind: 'money',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/expenses`,
  };
}

function costPerKilometre(input: InsightInput): OwnershipInsight | null {
  if (input.totalDistanceKm <= 0 || input.expenses.total === 0) return null;
  const perKm = input.expenses.total / input.totalDistanceKm;
  return {
    id: 'cost_per_km',
    question: 'What does it cost per kilometre?',
    answer: `Across ${Math.round(input.totalDistanceKm).toLocaleString()} km of logged driving.`,
    amount: perKm,
    numeric: perKm,
    kind: 'money',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/analytics`,
  };
}

function fuelShare(input: InsightInput): OwnershipInsight | null {
  if (input.expenses.total === 0) return null;
  const share = input.expenses.fuelSharePercent;
  return {
    id: 'fuel_share',
    question: 'How much of my cost is fuel?',
    answer: `Fuel is ${share}% of everything you have spent on this vehicle.`,
    numeric: share,
    kind: 'ratio',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/fuel`,
  };
}

function efficiencyDirection(input: InsightInput): OwnershipInsight | null {
  const trend = input.efficiencyTrend;
  if (trend.direction === 'unknown' || trend.changePercent === null) return null;

  const magnitude = Math.abs(Math.round(trend.changePercent));
  const answer =
    trend.direction === 'steady'
      ? 'Your fuel economy is holding steady.'
      : trend.direction === 'improving'
        ? `Your recent fill-ups are about ${magnitude}% more efficient than before.`
        : `Your recent fill-ups are about ${magnitude}% less efficient than before.`;

  return {
    id: 'efficiency_direction',
    question: 'Is my fuel economy improving?',
    answer,
    numeric: trend.changePercent,
    kind: 'trend',
    emphasis:
      trend.direction === 'improving'
        ? 'positive'
        : trend.direction === 'declining'
          ? 'negative'
          : 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/fuel/insights`,
  };
}

function priciestMonth(input: InsightInput): OwnershipInsight | null {
  const month = input.expenses.highestMonth;
  if (!month || input.expenses.byMonth.length < 2) return null;

  const topCategory = month.byCategory[0];
  return {
    id: 'priciest_month',
    question: 'Which month cost the most?',
    answer: topCategory
      ? `${formatMonthLabel(month.period)} — mostly ${EXPENSE_CATEGORY_LABEL[topCategory.category].toLowerCase()}.`
      : formatMonthLabel(month.period),
    amount: month.total,
    kind: 'money',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/expenses?month=${month.period}`,
  };
}

function maintenanceSpend(input: InsightInput): OwnershipInsight | null {
  const maintenance = input.expenses.byCategory.find((c) => c.category === 'maintenance');
  const repair = input.expenses.byCategory.find((c) => c.category === 'repair');
  if (!maintenance && !repair) return null;

  const total = (maintenance?.total ?? 0) + (repair?.total ?? 0);
  const count = (maintenance?.count ?? 0) + (repair?.count ?? 0);

  return {
    id: 'maintenance_spend',
    question: 'How much on maintenance and repairs?',
    answer: `Across ${count} visit${count === 1 ? '' : 's'}, ${input.expenses.maintenanceSharePercent}% of total cost.`,
    amount: total,
    kind: 'money',
    emphasis: 'neutral',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/maintenance`,
  };
}

function nextMajorService(input: InsightInput): OwnershipInsight | null {
  const upcoming = input.schedules.find(
    (s) => s.status !== 'unknown' && s.effectiveDueDate !== null,
  );
  if (!upcoming) return null;

  return {
    id: 'next_service',
    question: 'When is my next service?',
    answer: `${upcoming.title} — ${upcoming.reason.toLowerCase()}.`,
    kind: 'date',
    emphasis:
      upcoming.status === 'overdue'
        ? 'negative'
        : upcoming.status === 'ok'
          ? 'neutral'
          : 'negative',
    deepLink: `carbuddy://vehicle/${input.vehicleId}/maintenance/${upcoming.scheduleId}`,
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  const name = MONTH_NAMES[index];
  return name ? `${name} ${year}` : period;
}

/** Current-month key helper shared by the dashboard tiles. */
export function currentMonthKey(now: IsoDateTime | Date): string {
  return monthKey(now);
}
