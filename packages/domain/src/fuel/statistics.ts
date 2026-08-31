import {
  groupBy,
  mean,
  median,
  monthKey,
  type CurrencyCode,
  type IsoDateTime,
  type Kilometres,
  type Litres,
  type Money,
} from '../common/types.js';
import {
  combineEfficiency,
  efficiencyAs,
  efficiencyImprovement,
  isMeasurable,
  makeEfficiency,
  ZERO_EFFICIENCY,
  type FuelEconomyStandard,
  type FuelEfficiency,
} from '../units/units.js';
import { analyseConsumption, loggedDistance, sortFuelRecords } from './consumption.js';
import type { ConsumptionSegment, FuelRecord } from './types.js';

export interface FuelStatistics {
  readonly recordCount: number;
  readonly measuredSegmentCount: number;
  readonly totalLitres: Litres;
  readonly totalCost: Money;
  readonly currency: CurrencyCode;
  /** Distance between first and last logged fill-up. */
  readonly loggedDistanceKm: Kilometres;
  /** Distance actually covered by measurable segments. */
  readonly measuredDistanceKm: Kilometres;
  /** Lifetime average, computed as total distance / total fuel. */
  readonly averageEfficiency: FuelEfficiency;
  readonly bestSegment: ConsumptionSegment | null;
  readonly worstSegment: ConsumptionSegment | null;
  /** Weighted: total spend / total volume, not the mean of the pump prices. */
  readonly averagePricePerLitre: Money | null;
  readonly lowestPricePerLitre: Money | null;
  readonly highestPricePerLitre: Money | null;
  /** Fuel cost only, per kilometre. Ownership cost/km lives in the expense module. */
  readonly fuelCostPerKm: Money | null;
  readonly averageLitresPerFill: Litres | null;
  readonly averageDaysBetweenFills: number | null;
  readonly averageDistanceBetweenFillsKm: Kilometres | null;
  readonly firstRecordAt: IsoDateTime | null;
  readonly lastRecordAt: IsoDateTime | null;
}

const EMPTY_STATS: FuelStatistics = {
  recordCount: 0,
  measuredSegmentCount: 0,
  totalLitres: 0,
  totalCost: 0,
  currency: 'USD',
  loggedDistanceKm: 0,
  measuredDistanceKm: 0,
  averageEfficiency: ZERO_EFFICIENCY,
  bestSegment: null,
  worstSegment: null,
  averagePricePerLitre: null,
  lowestPricePerLitre: null,
  highestPricePerLitre: null,
  fuelCostPerKm: null,
  averageLitresPerFill: null,
  averageDaysBetweenFills: null,
  averageDistanceBetweenFillsKm: null,
  firstRecordAt: null,
  lastRecordAt: null,
};

/**
 * Roll a fuel log up into the numbers the dashboard and analytics screens show.
 *
 * Note which denominators are used where — they are not interchangeable:
 *   - Efficiency uses only *measured* distance (full-tank to full-tank), because
 *     that is the only distance we know the fuel for.
 *   - Spend and volume totals use *every* record, because the money left the
 *     user's account regardless of whether the fill was measurable.
 */
export function computeFuelStatistics(
  records: readonly FuelRecord[],
  fallbackCurrency: CurrencyCode = 'USD',
): FuelStatistics {
  if (records.length === 0) return { ...EMPTY_STATS, currency: fallbackCurrency };

  const sorted = sortFuelRecords(records);
  const { segments } = analyseConsumption(sorted);

  let totalLitres = 0;
  let totalCost = 0;
  let lowestPrice: number | null = null;
  let highestPrice: number | null = null;

  for (const record of sorted) {
    totalLitres += record.litres;
    totalCost += record.totalCost;
    if (record.litres > 0) {
      const unitPrice = record.totalCost / record.litres;
      lowestPrice = lowestPrice === null ? unitPrice : Math.min(lowestPrice, unitPrice);
      highestPrice = highestPrice === null ? unitPrice : Math.max(highestPrice, unitPrice);
    }
  }

  const averageEfficiency = combineEfficiency(segments.map((s) => s.efficiency));
  const measuredDistanceKm = averageEfficiency.kilometres;

  // Best/worst are ranked on km per litre. That ordering is standard-agnostic:
  // it produces the same winner whether the user reads MPG or L/100 km.
  let best: ConsumptionSegment | null = null;
  let worst: ConsumptionSegment | null = null;
  for (const segment of segments) {
    const kmPerLitre = segment.distanceKm / segment.litres;
    if (best === null || kmPerLitre > best.distanceKm / best.litres) best = segment;
    if (worst === null || kmPerLitre < worst.distanceKm / worst.litres) worst = segment;
  }

  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  const gapDays = segments.length > 0 ? mean(segments.map((s) => s.days)) : null;
  const gapDistance = segments.length > 0 ? mean(segments.map((s) => s.distanceKm)) : null;

  return {
    recordCount: sorted.length,
    measuredSegmentCount: segments.length,
    totalLitres,
    totalCost,
    currency: first?.currency ?? fallbackCurrency,
    loggedDistanceKm: loggedDistance(sorted),
    measuredDistanceKm,
    averageEfficiency,
    bestSegment: best,
    worstSegment: worst,
    averagePricePerLitre: totalLitres > 0 ? totalCost / totalLitres : null,
    lowestPricePerLitre: lowestPrice,
    highestPricePerLitre: highestPrice,
    fuelCostPerKm: measuredDistanceKm > 0 ? totalCost / measuredDistanceKm : null,
    averageLitresPerFill: sorted.length > 0 ? totalLitres / sorted.length : null,
    averageDaysBetweenFills: gapDays,
    averageDistanceBetweenFillsKm: gapDistance,
    firstRecordAt: first?.filledAt ?? null,
    lastRecordAt: last?.filledAt ?? null,
  };
}

export interface MonthlyFuelPoint {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly litres: Litres;
  readonly cost: Money;
  readonly fillCount: number;
  /** Efficiency of segments *ending* in this month; may be unmeasurable. */
  readonly efficiency: FuelEfficiency;
  readonly distanceKm: Kilometres;
}

/**
 * Month-by-month fuel series for the trend charts.
 *
 * Spend is bucketed by the date on the receipt. Efficiency is bucketed by the
 * date a segment *closed*, since that is the moment the measurement completed.
 */
export function monthlyFuelSeries(records: readonly FuelRecord[]): MonthlyFuelPoint[] {
  if (records.length === 0) return [];

  const { segments } = analyseConsumption(records);
  const byMonth = new Map<string, { litres: number; cost: number; fills: number }>();

  for (const record of records) {
    const key = monthKey(record.filledAt);
    const bucket = byMonth.get(key) ?? { litres: 0, cost: 0, fills: 0 };
    bucket.litres += record.litres;
    bucket.cost += record.totalCost;
    bucket.fills += 1;
    byMonth.set(key, bucket);
  }

  const segmentsByMonth = groupBy(segments, (s) => monthKey(s.endedAt));

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => {
      const monthSegments = segmentsByMonth.get(month) ?? [];
      const efficiency = combineEfficiency(monthSegments.map((s) => s.efficiency));
      return {
        month,
        litres: bucket.litres,
        cost: bucket.cost,
        fillCount: bucket.fills,
        efficiency,
        distanceKm: efficiency.kilometres,
      };
    });
}

export interface EfficiencyTrend {
  /** Positive always means improving, in whichever standard is displayed. */
  readonly changePercent: number | null;
  readonly direction: 'improving' | 'declining' | 'steady' | 'unknown';
  readonly recent: FuelEfficiency;
  readonly previous: FuelEfficiency;
  readonly sampleSize: number;
}

/**
 * Compare the last `window` segments against the `window` before them.
 *
 * Deliberately requires a full window on both sides. A trend drawn from two
 * fill-ups is noise, and presenting noise as a trend is worse than showing
 * nothing — so the "unknown" state is a real, designed state in the UI.
 */
export function efficiencyTrend(
  segments: readonly ConsumptionSegment[],
  standard: FuelEconomyStandard,
  window = 3,
  steadyThresholdPercent = 3,
): EfficiencyTrend {
  const usable = segments.filter((s) => isMeasurable(s.efficiency));
  if (usable.length < window * 2) {
    return {
      changePercent: null,
      direction: 'unknown',
      recent: combineEfficiency(usable.slice(-window).map((s) => s.efficiency)),
      previous: ZERO_EFFICIENCY,
      sampleSize: usable.length,
    };
  }

  const recentSegments = usable.slice(-window);
  const previousSegments = usable.slice(-window * 2, -window);
  const recent = combineEfficiency(recentSegments.map((s) => s.efficiency));
  const previous = combineEfficiency(previousSegments.map((s) => s.efficiency));

  const changePercent = efficiencyImprovement(previous, recent, standard);
  const direction =
    changePercent === null
      ? 'unknown'
      : Math.abs(changePercent) < steadyThresholdPercent
        ? 'steady'
        : changePercent > 0
          ? 'improving'
          : 'declining';

  return { changePercent, direction, recent, previous, sampleSize: usable.length };
}

/**
 * Robust baseline for a vehicle: the median km/L across segments, expressed as
 * an efficiency. The median rather than the mean, so one road trip or one
 * traffic-bound month does not redefine "normal".
 */
export function efficiencyBaseline(segments: readonly ConsumptionSegment[]): FuelEfficiency {
  const usable = segments.filter((s) => isMeasurable(s.efficiency));
  if (usable.length === 0) return ZERO_EFFICIENCY;
  const medianKmPerLitre = median(usable.map((s) => s.distanceKm / s.litres));
  if (medianKmPerLitre <= 0) return ZERO_EFFICIENCY;
  // Anchor on a nominal 100 km so the pair stays convertible to any standard.
  return makeEfficiency(100, 100 / medianKmPerLitre);
}

/** Convenience for chart axes: segment efficiency values in the display standard. */
export function efficiencySeries(
  segments: readonly ConsumptionSegment[],
  standard: FuelEconomyStandard,
): { date: IsoDateTime; value: number }[] {
  return segments
    .filter((s) => isMeasurable(s.efficiency))
    .map((s) => ({ date: s.endedAt, value: efficiencyAs(s.efficiency, standard) ?? 0 }))
    .filter((point) => point.value > 0);
}
