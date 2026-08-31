import { clamp, round } from '../common/types.js';
import type { ComponentEvaluation } from '../maintenance/components.js';
import type { DocumentEvaluation } from '../documents/types.js';
import type { ScheduleEvaluation } from '../maintenance/types.js';
import type { EfficiencyAnomaly } from '../fuel/anomaly.js';

export type HealthBand = 'excellent' | 'good' | 'attention' | 'action_needed' | 'unknown';

export interface HealthFactor {
  readonly id: 'maintenance' | 'documents' | 'components' | 'fuel';
  readonly label: string;
  /** 0–100 for this dimension. */
  readonly score: number;
  readonly band: HealthBand;
  /** Plain-language summary — the accessible label, not a colour. */
  readonly summary: string;
  readonly issueCount: number;
}

export interface VehicleHealth {
  readonly score: number;
  readonly band: HealthBand;
  readonly factors: readonly HealthFactor[];
  readonly headline: string;
  /** True when there is too little data for the score to mean anything. */
  readonly provisional: boolean;
}

export interface HealthInput {
  readonly schedules?: readonly ScheduleEvaluation[];
  readonly documents?: readonly DocumentEvaluation[];
  readonly components?: readonly ComponentEvaluation[];
  readonly fuelAnomaly?: EfficiencyAnomaly | null;
}

/**
 * Relative importance of each dimension.
 *
 * Maintenance and documents dominate deliberately: an expired registration or a
 * skipped brake service has consequences (fines, safety, a failed inspection)
 * that a mildly worse fuel figure does not.
 */
const WEIGHTS = { maintenance: 0.4, documents: 0.3, components: 0.2, fuel: 0.1 } as const;

/** Top of the "attention" band — the best a vehicle with a lapse can score. */
const CRITICAL_ISSUE_CEILING = 74;

function bandFor(score: number): HealthBand {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'attention';
  return 'action_needed';
}

/**
 * A single 0–100 read on how well a vehicle is being kept.
 *
 * The score is a communication device, not a measurement of the car — it is
 * computed only from what the user has told us, so a meticulously maintained
 * car with an empty log scores as `provisional` rather than badly. Every
 * contributing factor is returned alongside it with its own plain-language
 * summary, because a bare number ("72") is not actionable and, on its own,
 * would fail the "never rely on colour alone" rule the UI holds itself to.
 */
export function computeVehicleHealth(input: HealthInput): VehicleHealth {
  const schedules = input.schedules ?? [];
  const documents = input.documents ?? [];
  const components = input.components ?? [];

  const factors: HealthFactor[] = [];

  // --- Maintenance -------------------------------------------------------
  const tracked = schedules.filter((s) => s.status !== 'unknown');
  const overdue = tracked.filter((s) => s.status === 'overdue').length;
  const due = tracked.filter((s) => s.status === 'due').length;
  const dueSoon = tracked.filter((s) => s.status === 'due_soon').length;

  const maintenanceScore =
    tracked.length === 0 ? 100 : clamp(100 - (overdue * 30 + due * 15 + dueSoon * 5), 0, 100);

  factors.push({
    id: 'maintenance',
    label: 'Maintenance',
    score: maintenanceScore,
    band: tracked.length === 0 ? 'unknown' : bandFor(maintenanceScore),
    summary:
      tracked.length === 0
        ? 'No service schedules set up yet'
        : overdue > 0
          ? `${overdue} service${overdue === 1 ? '' : 's'} overdue`
          : due + dueSoon > 0
            ? `${due + dueSoon} service${due + dueSoon === 1 ? '' : 's'} coming up`
            : 'Everything up to date',
    issueCount: overdue + due,
  });

  // --- Documents ---------------------------------------------------------
  const dated = documents.filter((d) => d.status !== 'no_expiry');
  const expired = dated.filter((d) => d.status === 'expired').length;
  const expiring = dated.filter((d) => d.status === 'expiring_soon').length;

  const documentScore =
    dated.length === 0 ? 100 : clamp(100 - (expired * 40 + expiring * 10), 0, 100);

  factors.push({
    id: 'documents',
    label: 'Documents',
    score: documentScore,
    band: dated.length === 0 ? 'unknown' : bandFor(documentScore),
    summary:
      dated.length === 0
        ? 'No documents with expiry dates yet'
        : expired > 0
          ? `${expired} document${expired === 1 ? '' : 's'} expired`
          : expiring > 0
            ? `${expiring} expiring within 30 days`
            : 'All documents valid',
    issueCount: expired + expiring,
  });

  // --- Components --------------------------------------------------------
  const wearItems = components.filter((c) => c.status !== 'unknown');
  const wornOut = wearItems.filter((c) => c.status === 'overdue' || c.status === 'due').length;
  const wearingSoon = wearItems.filter((c) => c.status === 'due_soon').length;

  const componentScore =
    wearItems.length === 0 ? 100 : clamp(100 - (wornOut * 25 + wearingSoon * 8), 0, 100);

  factors.push({
    id: 'components',
    label: 'Wear items',
    score: componentScore,
    band: wearItems.length === 0 ? 'unknown' : bandFor(componentScore),
    summary:
      wearItems.length === 0
        ? 'No tyres, battery or brakes tracked yet'
        : wornOut > 0
          ? `${wornOut} item${wornOut === 1 ? '' : 's'} at end of life`
          : wearingSoon > 0
            ? `${wearingSoon} item${wearingSoon === 1 ? '' : 's'} wearing out`
            : 'Wear items in good shape',
    issueCount: wornOut,
  });

  // --- Fuel --------------------------------------------------------------
  const anomaly = input.fuelAnomaly ?? null;
  const fuelScore =
    !anomaly || anomaly.severity === 'none' || anomaly.direction !== 'worse'
      ? 100
      : anomaly.severity === 'significant'
        ? 55
        : anomaly.severity === 'notable'
          ? 75
          : 90;

  // No fuel log at all, or too short a one, is "we don't know" — not a free
  // 100. Scoring it as perfect would let an empty app inflate the headline.
  const fuelKnown = anomaly !== null && anomaly.note !== 'insufficient_history';

  factors.push({
    id: 'fuel',
    label: 'Fuel economy',
    score: fuelScore,
    band: fuelKnown ? bandFor(fuelScore) : 'unknown',
    summary: !fuelKnown
      ? 'Log a few more fill-ups to see trends'
      : anomaly && anomaly.direction === 'worse' && anomaly.severity !== 'none'
        ? `Using about ${Math.abs(Math.round(anomaly.deviationPercent))}% more fuel than usual`
        : anomaly?.direction === 'better'
          ? 'Better than your usual average'
          : 'In line with your usual average',
    issueCount: anomaly && anomaly.direction === 'worse' && anomaly.severity !== 'none' ? 1 : 0,
  });

  // Dimensions with no data are excluded from the weighted mean rather than
  // scored as 100 — otherwise an empty app would proudly report perfect health.
  const known = factors.filter((f) => f.band !== 'unknown');
  const provisional = known.length < 2;

  const totalWeight = known.reduce((acc, f) => acc + WEIGHTS[f.id], 0);
  const weighted =
    totalWeight === 0
      ? 0
      : round(known.reduce((acc, f) => acc + f.score * WEIGHTS[f.id], 0) / totalWeight, 0);

  // A weighted average alone is too forgiving about the things that actually
  // matter: a car with a spotless service record and expired insurance would
  // still score in the eighties and read as "good". Anything expired or overdue
  // therefore caps the headline into the "attention" band, no matter how well
  // every other dimension scores. The user can be told they are mostly on top
  // of things, but never that they are fine, while something is lapsed.
  const hasCriticalIssue =
    (input.documents ?? []).some((d) => d.status === 'expired') ||
    (input.schedules ?? []).some((s) => s.status === 'overdue');

  const score = hasCriticalIssue ? Math.min(weighted, CRITICAL_ISSUE_CEILING) : weighted;
  const band: HealthBand = provisional ? 'unknown' : bandFor(score);

  return {
    score,
    band,
    factors,
    headline: headlineFor(band, factors),
    provisional,
  };
}

function headlineFor(band: HealthBand, factors: readonly HealthFactor[]): string {
  if (band === 'unknown') return 'Add a little more information to see your vehicle health';

  const worst = [...factors]
    .filter((f) => f.band !== 'unknown' && f.issueCount > 0)
    .sort((a, b) => a.score - b.score)[0];

  switch (band) {
    case 'excellent':
      return 'Everything looks well cared for';
    case 'good':
      return worst ? `Mostly on track — ${worst.summary.toLowerCase()}` : 'Mostly on track';
    case 'attention':
      return worst
        ? `Needs attention — ${worst.summary.toLowerCase()}`
        : 'A few things need attention';
    case 'action_needed':
      return worst
        ? `Action needed — ${worst.summary.toLowerCase()}`
        : 'Several things need action';
  }
}
