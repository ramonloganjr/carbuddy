import {
  addDays,
  addMonths,
  clamp,
  daysBetween,
  round,
  type CurrencyCode,
  type IsoDateTime,
  type Kilometres,
  type Money,
  type UUID,
} from '../common/types.js';
import type { DueStatus } from './types.js';

/**
 * Wear items tracked across their whole life rather than as one-off services.
 * A user cares about "how much life is left in these tyres", which is a
 * different question from "when is the next service".
 */
export type ComponentKind =
  | 'tyre_set'
  | 'battery'
  | 'brake_pads_front'
  | 'brake_pads_rear'
  | 'brake_discs_front'
  | 'brake_discs_rear'
  | 'air_filter'
  | 'cabin_filter'
  | 'oil_filter'
  | 'spark_plugs'
  | 'timing_belt'
  | 'serpentine_belt'
  | 'shock_absorbers'
  | 'wiper_blades'
  | 'coolant'
  | 'clutch'
  | 'custom';

export interface VehicleComponent {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly kind: ComponentKind;
  readonly label?: string;
  readonly brand?: string;
  readonly model?: string;
  /** Free-form spec: tyre size `205/55 R16 91V`, battery `DIN 74Ah 680A`. */
  readonly specification?: string;
  readonly installedAt: IsoDateTime;
  readonly installedOdometerKm: Kilometres;
  readonly purchasePrice?: Money;
  readonly currency?: CurrencyCode;
  readonly expectedLifeMonths?: number;
  readonly expectedLifeKm?: Kilometres;
  readonly warrantyExpiresAt?: IsoDateTime;
  readonly warrantyDistanceKm?: Kilometres;
  /** Tyres only: rotation interval. */
  readonly rotationIntervalKm?: Kilometres;
  readonly lastRotatedOdometerKm?: Kilometres;
  readonly removedAt?: IsoDateTime;
  readonly removedOdometerKm?: Kilometres;
  readonly notes?: string;
}

/**
 * Typical service life, used only when the user has not entered their own.
 *
 * These are conservative mid-range figures, not manufacturer specifications.
 * They exist so a new user gets useful reminders on day one; every value is
 * editable, and the UI labels them as estimates rather than facts.
 */
export const DEFAULT_COMPONENT_LIFE: Readonly<
  Record<ComponentKind, { months?: number; km?: number }>
> = {
  tyre_set: { months: 60, km: 50_000 },
  battery: { months: 48 },
  brake_pads_front: { km: 45_000 },
  brake_pads_rear: { km: 60_000 },
  brake_discs_front: { km: 90_000 },
  brake_discs_rear: { km: 110_000 },
  air_filter: { months: 12, km: 20_000 },
  cabin_filter: { months: 12, km: 20_000 },
  oil_filter: { months: 12, km: 15_000 },
  spark_plugs: { km: 60_000 },
  timing_belt: { months: 84, km: 100_000 },
  serpentine_belt: { months: 60, km: 90_000 },
  shock_absorbers: { km: 100_000 },
  wiper_blades: { months: 12 },
  coolant: { months: 48, km: 80_000 },
  clutch: { km: 150_000 },
  custom: {},
};

export const COMPONENT_LABEL: Readonly<Record<ComponentKind, string>> = {
  tyre_set: 'Tyres',
  battery: 'Battery',
  brake_pads_front: 'Front brake pads',
  brake_pads_rear: 'Rear brake pads',
  brake_discs_front: 'Front brake discs',
  brake_discs_rear: 'Rear brake discs',
  air_filter: 'Air filter',
  cabin_filter: 'Cabin filter',
  oil_filter: 'Oil filter',
  spark_plugs: 'Spark plugs',
  timing_belt: 'Timing belt',
  serpentine_belt: 'Drive belt',
  shock_absorbers: 'Shock absorbers',
  wiper_blades: 'Wiper blades',
  coolant: 'Coolant',
  clutch: 'Clutch',
  custom: 'Component',
};

export interface ComponentEvaluation {
  readonly componentId: UUID;
  readonly kind: ComponentKind;
  readonly label: string;
  readonly status: DueStatus;
  /** 0 = new, 1 = at end of expected life, >1 = past it. */
  readonly wear: number;
  readonly ageMonths: number;
  readonly distanceCoveredKm: Kilometres;
  readonly remainingKm: Kilometres | null;
  readonly remainingDays: number | null;
  readonly estimatedReplacementDate: IsoDateTime | null;
  readonly warrantyActive: boolean;
  readonly warrantyDaysRemaining: number | null;
  /** Tyres: distance until the next rotation. */
  readonly rotationDueInKm: Kilometres | null;
  /** True when the estimate came from our defaults rather than user input. */
  readonly usingDefaultLife: boolean;
  readonly reason: string;
}

export interface ComponentContext {
  readonly now: IsoDateTime | Date;
  readonly currentOdometerKm: Kilometres;
  readonly averageDailyDistanceKm?: number | null;
}

/**
 * Project how much life a wear item has left.
 *
 * Wear is taken as the worse of age-based and distance-based consumption,
 * because a five-year-old tyre with 8,000 km on it is aged out even though the
 * tread is fine, and a one-year-old tyre with 60,000 km is worn out even though
 * it is new. Taking the maximum is what makes both cases behave sensibly.
 */
export function evaluateComponent(
  component: VehicleComponent,
  context: ComponentContext,
): ComponentEvaluation {
  const now = context.now instanceof Date ? context.now : new Date(context.now);
  const defaults = DEFAULT_COMPONENT_LIFE[component.kind] ?? {};
  const lifeMonths = component.expectedLifeMonths ?? defaults.months;
  const lifeKm = component.expectedLifeKm ?? defaults.km;
  const usingDefaultLife =
    component.expectedLifeMonths === undefined && component.expectedLifeKm === undefined;

  const ageDays = Math.max(0, daysBetween(component.installedAt, now));
  const ageMonths = round(ageDays / 30.44, 1);
  const distanceCoveredKm = Math.max(0, context.currentOdometerKm - component.installedOdometerKm);

  const ageWear = lifeMonths ? ageDays / (lifeMonths * 30.44) : 0;
  const distanceWear = lifeKm ? distanceCoveredKm / lifeKm : 0;
  const wear = Math.max(ageWear, distanceWear);

  const remainingKm = lifeKm ? lifeKm - distanceCoveredKm : null;
  const remainingDays = lifeMonths
    ? daysBetween(now, addMonths(component.installedAt, lifeMonths))
    : null;

  // Prefer whichever bound runs out first, expressed as a date.
  const dailyKm = context.averageDailyDistanceKm ?? null;
  const distanceDate =
    remainingKm !== null && dailyKm !== null && dailyKm > 0
      ? addDays(now, remainingKm / dailyKm)
      : null;
  const ageDate = lifeMonths ? addMonths(component.installedAt, lifeMonths) : null;
  const candidates = [distanceDate, ageDate].filter((d): d is Date => d !== null);
  const estimatedReplacementDate =
    candidates.length > 0 ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;

  const status = statusFromWear(wear, lifeMonths === undefined && lifeKm === undefined);

  const warrantyDaysRemaining = component.warrantyExpiresAt
    ? daysBetween(now, component.warrantyExpiresAt)
    : null;
  const warrantyWithinDistance =
    component.warrantyDistanceKm === undefined || distanceCoveredKm <= component.warrantyDistanceKm;
  const warrantyActive =
    warrantyDaysRemaining !== null && warrantyDaysRemaining >= 0 && warrantyWithinDistance;

  const rotationDueInKm =
    component.rotationIntervalKm !== undefined
      ? (component.lastRotatedOdometerKm ?? component.installedOdometerKm) +
        component.rotationIntervalKm -
        context.currentOdometerKm
      : null;

  return {
    componentId: component.id,
    kind: component.kind,
    label: component.label ?? COMPONENT_LABEL[component.kind],
    status,
    wear: round(clamp(wear, 0, 2), 3),
    ageMonths,
    distanceCoveredKm,
    remainingKm,
    remainingDays,
    estimatedReplacementDate: estimatedReplacementDate?.toISOString() ?? null,
    warrantyActive,
    warrantyDaysRemaining,
    rotationDueInKm,
    usingDefaultLife,
    reason: describeComponent(status, wear, remainingKm, remainingDays),
  };
}

function statusFromWear(wear: number, noLifeData: boolean): DueStatus {
  if (noLifeData) return 'unknown';
  if (wear >= 1) return 'overdue';
  if (wear >= 0.95) return 'due';
  if (wear >= 0.8) return 'due_soon';
  return 'ok';
}

function describeComponent(
  status: DueStatus,
  wear: number,
  remainingKm: number | null,
  remainingDays: number | null,
): string {
  if (status === 'unknown') return 'Set an expected life to track wear';
  if (status === 'overdue') return 'Past its expected life';
  if (
    remainingKm !== null &&
    remainingKm > 0 &&
    (remainingDays === null || remainingKm / 50 < remainingDays)
  ) {
    return `About ${Math.round(remainingKm).toLocaleString()} km of life left`;
  }
  if (remainingDays !== null && remainingDays > 0) {
    const months = Math.round(remainingDays / 30.44);
    return months >= 2 ? `About ${months} months left` : `About ${remainingDays} days left`;
  }
  return `${Math.round(wear * 100)}% of expected life used`;
}

export function evaluateComponents(
  components: readonly VehicleComponent[],
  context: ComponentContext,
): ComponentEvaluation[] {
  return components
    .filter((c) => !c.removedAt)
    .map((c) => evaluateComponent(c, context))
    .sort((a, b) => b.wear - a.wear);
}

/**
 * Cost per kilometre of a wear item that has been replaced — the number that
 * answers "were the expensive tyres actually worth it?".
 */
export function componentCostPerKm(component: VehicleComponent): number | null {
  if (component.purchasePrice === undefined || component.removedOdometerKm === undefined) {
    return null;
  }
  const distance = component.removedOdometerKm - component.installedOdometerKm;
  if (distance <= 0) return null;
  return component.purchasePrice / distance;
}
