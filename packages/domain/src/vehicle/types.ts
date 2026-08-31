import type {
  CurrencyCode,
  IsoDateTime,
  Kilometres,
  Litres,
  Money,
  UUID,
} from '../common/types.js';
import type { FuelGrade, FuelType } from '../fuel/types.js';

export type VehicleBodyType =
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'crossover'
  | 'coupe'
  | 'convertible'
  | 'wagon'
  | 'pickup'
  | 'van'
  | 'minivan'
  | 'motorcycle'
  | 'truck'
  | 'other';

export type TransmissionType = 'manual' | 'automatic' | 'cvt' | 'dct' | 'amt' | 'single_speed';
export type Drivetrain = 'fwd' | 'rwd' | 'awd' | '4wd';
export type EngineType =
  'petrol' | 'diesel' | 'hybrid' | 'plugin_hybrid' | 'electric' | 'hydrogen' | 'lpg' | 'cng';

/** Tyre specification, kept structured so sizes can be validated and compared. */
export interface TyreSpecification {
  readonly width?: number;
  readonly aspectRatio?: number;
  readonly rimDiameter?: number;
  readonly loadIndex?: string;
  readonly speedRating?: string;
  /** Recommended cold pressure in kPa (canonical). */
  readonly frontPressureKpa?: number;
  readonly rearPressureKpa?: number;
}

export interface BatterySpecification {
  readonly type?: string;
  readonly capacityAh?: number;
  readonly coldCrankingAmps?: number;
  readonly voltage?: number;
  /** Electric vehicles: usable pack capacity. */
  readonly packCapacityKwh?: number;
}

export interface WarrantyInformation {
  readonly provider?: string;
  readonly expiresAt?: IsoDateTime;
  readonly distanceLimitKm?: Kilometres;
  readonly notes?: string;
}

export interface FinancingInformation {
  readonly lender?: string;
  readonly monthlyPayment?: Money;
  readonly currency?: CurrencyCode;
  readonly termMonths?: number;
  readonly startedAt?: IsoDateTime;
  readonly interestRatePercent?: number;
  readonly remainingBalance?: Money;
}

/**
 * The full digital profile of a vehicle.
 *
 * Almost every field is optional by design. Someone adding their car during
 * onboarding should be able to type a nickname and a plate and be done — the
 * specification fields are there for owners who want them, filled in over time,
 * never as a wall of required inputs on day one.
 */
export interface Vehicle {
  readonly id: UUID;
  readonly userId: UUID;
  readonly nickname: string;
  readonly make: string;
  readonly model: string;
  readonly variant?: string;
  readonly modelYear?: number;
  readonly bodyType?: VehicleBodyType;
  readonly colour?: string;

  readonly engineType?: EngineType;
  readonly engineDisplacementCc?: number;
  readonly cylinders?: number;
  readonly transmission?: TransmissionType;
  readonly drivetrain?: Drivetrain;
  readonly fuelType?: FuelType;
  readonly fuelTankCapacityL?: Litres;
  readonly recommendedFuelGrade?: FuelGrade;
  readonly batterySpecification?: BatterySpecification;
  readonly tyreSpecification?: TyreSpecification;

  /** Sensitive identifiers — masked in list views, revealed on explicit tap. */
  readonly vin?: string;
  readonly engineNumber?: string;
  readonly plateNumber?: string;
  readonly registrationNumber?: string;
  readonly registrationCountry?: string;

  readonly purchasedAt?: IsoDateTime;
  readonly purchasePrice?: Money;
  readonly purchaseOdometerKm?: Kilometres;
  readonly currency: CurrencyCode;
  readonly dealerName?: string;
  readonly dealerContact?: string;
  readonly financing?: FinancingInformation;
  readonly warranty?: WarrantyInformation;

  /** Latest known reading. Updated by fuel entries and manual check-ins. */
  readonly currentOdometerKm: Kilometres;
  readonly odometerUpdatedAt?: IsoDateTime;

  readonly photoAttachmentId?: UUID;
  readonly isPrimary?: boolean;
  readonly archivedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface OdometerReading {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly odometerKm: Kilometres;
  readonly recordedAt: IsoDateTime;
  readonly source: 'manual' | 'fuel_record' | 'maintenance_record' | 'expense';
  readonly sourceId?: UUID;
  readonly notes?: string;
}
