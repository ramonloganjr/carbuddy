import type {
  CurrencyCode,
  IsoDateTime,
  Kilometres,
  Litres,
  Money,
  UUID,
} from '../common/types.js';
import type { FuelEfficiency } from '../units/units.js';

export type FuelType =
  'gasoline' | 'diesel' | 'lpg' | 'cng' | 'ethanol' | 'biodiesel' | 'electric' | 'hydrogen';

export type FuelGrade = 'regular' | 'midgrade' | 'premium' | 'super_premium' | 'diesel' | 'other';

export type PaymentMethod =
  'cash' | 'credit_card' | 'debit_card' | 'fuel_card' | 'mobile' | 'other';

/**
 * A single refuelling transaction, exactly as the user entered it.
 *
 * `litres` and `odometerKm` are canonical units — the input screens convert
 * from gallons/miles before constructing this. `totalCost` is minor units.
 */
export interface FuelRecord {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly filledAt: IsoDateTime;
  readonly odometerKm: Kilometres;
  readonly litres: Litres;
  readonly totalCost: Money;
  readonly currency: CurrencyCode;
  readonly fuelType: FuelType;
  readonly fuelGrade?: FuelGrade;
  /**
   * Whether the tank was filled to the top. Consumption can only be measured
   * between two full tanks, so this flag drives the entire calculation.
   */
  readonly isFullTank: boolean;
  /**
   * Set by the user when they know a previous fill-up went unlogged. It breaks
   * the chain so a fabricated segment does not poison the averages.
   */
  readonly missedFill?: boolean;
  readonly stationName?: string;
  readonly stationBrand?: string;
  readonly paymentMethod?: PaymentMethod;
  readonly notes?: string;
  readonly attachmentIds?: readonly UUID[];
}

/**
 * A measurable stretch of driving: from one full tank to the next.
 * Every efficiency number in the product ultimately derives from these.
 */
export interface ConsumptionSegment {
  readonly fromRecordId: UUID;
  readonly toRecordId: UUID;
  readonly startedAt: IsoDateTime;
  readonly endedAt: IsoDateTime;
  readonly startOdometerKm: Kilometres;
  readonly endOdometerKm: Kilometres;
  readonly distanceKm: Kilometres;
  /** Fuel burned over the segment: everything added after the opening full tank. */
  readonly litres: Litres;
  readonly efficiency: FuelEfficiency;
  /** Money spent on that same fuel. */
  readonly cost: Money;
  readonly currency: CurrencyCode;
  /** Elapsed days; 0 for two fills on the same day. */
  readonly days: number;
  /** How many fill-ups (including partials) made up this segment. */
  readonly fillCount: number;
}

/** Records that could not be turned into a segment, and why. */
export interface UnmeasuredRecord {
  readonly recordId: UUID;
  readonly reason:
    | 'before_first_full_tank'
    | 'partial_fill'
    | 'missed_fill_reset'
    | 'no_distance'
    | 'no_fuel'
    | 'pending_next_full_tank';
}

export interface ConsumptionAnalysis {
  readonly segments: readonly ConsumptionSegment[];
  readonly unmeasured: readonly UnmeasuredRecord[];
}
