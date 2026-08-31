import type { CurrencyCode, IsoDateTime, Kilometres, Money, UUID } from '../common/types.js';

/**
 * Service categories the app understands natively. `custom` is the escape
 * hatch — the schema never blocks a user from logging work we did not predict.
 */
export type MaintenanceCategory =
  | 'engine_oil'
  | 'oil_filter'
  | 'air_filter'
  | 'cabin_filter'
  | 'fuel_filter'
  | 'transmission_fluid'
  | 'coolant'
  | 'brake_fluid'
  | 'power_steering_fluid'
  | 'brake_pads'
  | 'brake_discs'
  | 'battery'
  | 'spark_plugs'
  | 'ignition_coils'
  | 'timing_belt'
  | 'serpentine_belt'
  | 'tyres'
  | 'tyre_rotation'
  | 'wheel_alignment'
  | 'wheel_balancing'
  | 'suspension'
  | 'shock_absorbers'
  | 'clutch'
  | 'exhaust'
  | 'air_conditioning'
  | 'wiper_blades'
  | 'lights'
  | 'inspection'
  | 'general_service'
  | 'repair'
  | 'bodywork'
  | 'detailing'
  | 'custom';

export interface MaintenanceRecord {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly category: MaintenanceCategory;
  /** Free-text title; required for `custom`, optional elsewhere. */
  readonly title?: string;
  readonly servicedAt: IsoDateTime;
  readonly odometerKm: Kilometres;
  readonly providerName?: string;
  readonly providerContact?: string;
  readonly partsCost: Money;
  readonly labourCost: Money;
  readonly taxCost: Money;
  /**
   * Stored rather than derived. Receipts round in ways component costs do not
   * always reproduce, and the user's total must match the paper in their hand.
   */
  readonly totalCost: Money;
  readonly currency: CurrencyCode;
  readonly partsReplaced?: readonly string[];
  readonly warrantyMonths?: number;
  readonly warrantyDistanceKm?: Kilometres;
  readonly nextServiceDate?: IsoDateTime;
  readonly nextServiceOdometerKm?: Kilometres;
  readonly notes?: string;
  readonly attachmentIds?: readonly UUID[];
}

/**
 * A recurring service rule. Either bound may be omitted; when both are present
 * the rule fires on whichever arrives first, which is how manufacturers
 * actually write service schedules ("every 12 months or 15,000 km").
 */
export interface MaintenanceSchedule {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly intervalMonths?: number;
  readonly intervalDistanceKm?: Kilometres;
  /** Anchor point: when the work was last done. */
  readonly lastServicedAt?: IsoDateTime;
  readonly lastServiceOdometerKm?: Kilometres;
  /** Warn this many days ahead of the date bound. */
  readonly leadTimeDays?: number;
  /** Warn this many kilometres ahead of the distance bound. */
  readonly leadTimeKm?: Kilometres;
  readonly enabled: boolean;
  readonly notes?: string;
}

export type DueStatus = 'ok' | 'due_soon' | 'due' | 'overdue' | 'unknown';

/** Which bound is driving the result — surfaced so the UI can explain itself. */
export type DueDriver = 'time' | 'distance' | 'none';

export interface ScheduleEvaluation {
  readonly scheduleId: UUID;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly status: DueStatus;
  readonly driver: DueDriver;
  /** Date bound, when the schedule has one and an anchor date. */
  readonly dueDate: IsoDateTime | null;
  /** Distance bound, when the schedule has one and an anchor reading. */
  readonly dueOdometerKm: Kilometres | null;
  /** Negative once overdue. */
  readonly daysRemaining: number | null;
  readonly distanceRemainingKm: Kilometres | null;
  /**
   * Distance bound translated into a date using recent driving habits, so the
   * UI can say "about 5 weeks" instead of "3,200 km".
   */
  readonly projectedDueDate: IsoDateTime | null;
  /** The earlier of the date bound and the projected distance date. */
  readonly effectiveDueDate: IsoDateTime | null;
  /** 0 at the last service, 1 at the bound, >1 when overdue. */
  readonly progress: number;
  readonly reason: string;
}

export interface ScheduleContext {
  readonly now: IsoDateTime | Date;
  readonly currentOdometerKm: Kilometres;
  /** From the fuel log; enables date projection for distance-based rules. */
  readonly averageDailyDistanceKm?: number | null;
}
