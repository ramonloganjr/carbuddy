import { median, medianAbsoluteDeviation, round } from '../common/types.js';
import { combineEfficiency, isMeasurable, type FuelEfficiency } from '../units/units.js';
import type { ConsumptionSegment } from './types.js';

/**
 * Informational factors that commonly move real-world fuel economy.
 *
 * These are prompts for the driver to consider, not diagnoses. The product
 * never asserts a mechanical cause from fuel data alone — it cannot know one —
 * so the copy attached to each factor is phrased as a question or a check.
 */
export type EfficiencyFactor =
  | 'driving_conditions'
  | 'short_trips'
  | 'tyre_pressure'
  | 'vehicle_load'
  | 'air_conditioning'
  | 'maintenance_due'
  | 'fuel_quality'
  | 'seasonal_weather'
  | 'measurement_accuracy';

export const EFFICIENCY_FACTOR_COPY: Readonly<
  Record<EfficiencyFactor, { title: string; body: string }>
> = {
  driving_conditions: {
    title: 'Different roads lately?',
    body: 'Stop-start city traffic, hills, or heavy congestion use noticeably more fuel than steady highway driving.',
  },
  short_trips: {
    title: 'More short trips?',
    body: 'A cold engine runs rich for the first few kilometres, so a run of short journeys costs more per kilometre.',
  },
  tyre_pressure: {
    title: 'Worth checking tyre pressure',
    body: 'Under-inflated tyres increase rolling resistance. Checking them takes a minute and is worth ruling out.',
  },
  vehicle_load: {
    title: 'Carrying more than usual?',
    body: 'Extra weight, a roof box, or a bike rack all raise fuel use — roof loads especially, because of drag.',
  },
  air_conditioning: {
    title: 'Heavy air-conditioning use',
    body: 'Running the A/C hard, particularly in slow traffic, measurably increases consumption.',
  },
  maintenance_due: {
    title: 'A service may be due',
    body: 'A clogged air filter, tired spark plugs, or old engine oil can each nudge consumption upward.',
  },
  fuel_quality: {
    title: 'New fuel station or grade?',
    body: 'Switching station or fuel grade can shift your figures. Worth noting if the change lines up with a new supplier.',
  },
  seasonal_weather: {
    title: 'Colder weather',
    body: 'Winter fuel blends, longer warm-up times, and cold-dense air all reduce economy for most vehicles.',
  },
  measurement_accuracy: {
    title: 'Check the last few entries',
    body: 'A partial fill logged as a full tank, or a mistyped odometer reading, will skew the calculation.',
  },
};

export type AnomalySeverity = 'none' | 'info' | 'notable' | 'significant';

export interface EfficiencyAnomaly {
  readonly severity: AnomalySeverity;
  readonly direction: 'worse' | 'better' | 'stable';
  /** Change vs. baseline in km/L terms; negative means worse economy. */
  readonly deviationPercent: number;
  /** Robust z-score against the historical spread. */
  readonly robustScore: number | null;
  readonly baseline: FuelEfficiency;
  readonly recent: FuelEfficiency;
  readonly baselineSampleSize: number;
  readonly recentSampleSize: number;
  /** Suggestions to consider, most likely first. Empty unless severity fires. */
  readonly factors: readonly EfficiencyFactor[];
  /** Why no anomaly was reported, when severity is `none`. */
  readonly note?: 'insufficient_history' | 'within_normal_range';
}

export interface AnomalyDetectionOptions {
  /** Segments forming the "recent" sample. */
  readonly recentWindow?: number;
  /** Minimum prior segments before any judgement is made. */
  readonly minBaselineSegments?: number;
  /** Ignore swings smaller than this, in percent. */
  readonly deviationThresholdPercent?: number;
  /** Robust z-score above which a deviation is considered real. */
  readonly robustScoreThreshold?: number;
  /** Month index (0-11) of the recent sample, used only to offer the seasonal hint. */
  readonly recentMonth?: number;
}

const DEFAULTS: Required<Omit<AnomalyDetectionOptions, 'recentMonth'>> = {
  recentWindow: 3,
  minBaselineSegments: 5,
  deviationThresholdPercent: 12,
  robustScoreThreshold: 2,
};

/**
 * Detect whether recent fuel economy has drifted meaningfully from a vehicle's
 * own historical baseline.
 *
 * The design goal is a low false-positive rate. A notification that cries wolf
 * about normal variation trains users to ignore every future alert, so two
 * independent conditions must both hold before anything is reported:
 *
 *   1. The change exceeds a percentage floor (people do not care about 4%).
 *   2. The change is large relative to *this vehicle's own* historical spread,
 *      measured with median + MAD rather than mean + standard deviation. A car
 *      whose economy naturally swings 20% between summer and winter should not
 *      be flagged every autumn; a car that has been rock-steady for a year
 *      should be flagged on a smaller move.
 *
 * The comparison is done in km/L, which is monotonic with efficiency, so the
 * result does not depend on the user's display preference.
 */
export function detectEfficiencyAnomaly(
  segments: readonly ConsumptionSegment[],
  options: AnomalyDetectionOptions = {},
): EfficiencyAnomaly {
  const config = { ...DEFAULTS, ...options };
  const usable = segments.filter((s) => isMeasurable(s.efficiency));

  const recentSegments = usable.slice(-config.recentWindow);
  const baselineSegments = usable.slice(0, Math.max(0, usable.length - config.recentWindow));

  const recent = combineEfficiency(recentSegments.map((s) => s.efficiency));
  const baseline = combineEfficiency(baselineSegments.map((s) => s.efficiency));

  if (baselineSegments.length < config.minBaselineSegments || recentSegments.length === 0) {
    return {
      severity: 'none',
      direction: 'stable',
      deviationPercent: 0,
      robustScore: null,
      baseline,
      recent,
      baselineSampleSize: baselineSegments.length,
      recentSampleSize: recentSegments.length,
      factors: [],
      note: 'insufficient_history',
    };
  }

  const baselineRates = baselineSegments.map((s) => s.distanceKm / s.litres);
  const baselineMedian = median(baselineRates);
  const spread = medianAbsoluteDeviation(baselineRates);
  const recentRate = recent.kilometres / recent.litres;

  if (baselineMedian <= 0) {
    return {
      severity: 'none',
      direction: 'stable',
      deviationPercent: 0,
      robustScore: null,
      baseline,
      recent,
      baselineSampleSize: baselineSegments.length,
      recentSampleSize: recentSegments.length,
      factors: [],
      note: 'insufficient_history',
    };
  }

  const deviationPercent = ((recentRate - baselineMedian) / baselineMedian) * 100;
  // A perfectly consistent history gives MAD 0; fall back to the percentage
  // test alone rather than reporting an infinite score.
  const robustScore = spread > 0 ? (recentRate - baselineMedian) / spread : null;

  const exceedsPercentage = Math.abs(deviationPercent) >= config.deviationThresholdPercent;
  const exceedsSpread =
    robustScore === null ? exceedsPercentage : Math.abs(robustScore) >= config.robustScoreThreshold;

  if (!exceedsPercentage || !exceedsSpread) {
    return {
      severity: 'none',
      direction: 'stable',
      deviationPercent: round(deviationPercent, 1),
      robustScore: robustScore === null ? null : round(robustScore, 2),
      baseline,
      recent,
      baselineSampleSize: baselineSegments.length,
      recentSampleSize: recentSegments.length,
      factors: [],
      note: 'within_normal_range',
    };
  }

  const magnitude = Math.abs(deviationPercent);
  const severity: AnomalySeverity =
    magnitude >= 25 ? 'significant' : magnitude >= 18 ? 'notable' : 'info';
  const direction = deviationPercent < 0 ? 'worse' : 'better';

  return {
    severity,
    direction,
    deviationPercent: round(deviationPercent, 1),
    robustScore: robustScore === null ? null : round(robustScore, 2),
    baseline,
    recent,
    baselineSampleSize: baselineSegments.length,
    recentSampleSize: recentSegments.length,
    factors: suggestFactors(direction, recentSegments, options.recentMonth),
  };
}

/**
 * Order the informational prompts by how plausible they are for this pattern.
 *
 * Only ever suggestions. When economy has *improved* there is nothing to check,
 * so we say so with an empty list rather than inventing an explanation.
 */
function suggestFactors(
  direction: 'worse' | 'better',
  recentSegments: readonly ConsumptionSegment[],
  recentMonth?: number,
): EfficiencyFactor[] {
  if (direction === 'better') return [];

  const factors: EfficiencyFactor[] = [];

  // Short segments point at short trips or a measurement slip more than at
  // anything mechanical, so they lead when the recent distances are small.
  const averageDistance =
    recentSegments.length > 0
      ? recentSegments.reduce((acc, s) => acc + s.distanceKm, 0) / recentSegments.length
      : 0;
  if (averageDistance > 0 && averageDistance < 200) {
    factors.push('short_trips', 'measurement_accuracy');
  }

  factors.push('driving_conditions', 'tyre_pressure', 'vehicle_load');

  // Northern-hemisphere winter months. Offered as a hint, never as a claim.
  if (recentMonth !== undefined && (recentMonth <= 1 || recentMonth >= 10)) {
    factors.push('seasonal_weather');
  } else {
    factors.push('air_conditioning');
  }

  factors.push('maintenance_due', 'fuel_quality');

  if (!factors.includes('measurement_accuracy')) factors.push('measurement_accuracy');

  return factors.slice(0, 5);
}
