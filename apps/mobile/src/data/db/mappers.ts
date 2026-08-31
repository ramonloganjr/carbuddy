import type {
  Expense,
  FuelRecord,
  MaintenanceRecord,
  MaintenanceSchedule,
  OdometerReading,
  Vehicle,
  VehicleComponent,
  VehicleDocument,
} from '@carbuddy/domain';

/**
 * Row <-> domain mapping.
 *
 * SQLite has no boolean and no JSON type, so booleans round-trip through 0/1
 * and structured fields through TEXT. Keeping every one of those conversions in
 * this file means the rest of the app only ever handles proper domain objects —
 * no screen has to remember that `is_full_tank` is an integer.
 */

const bool = (value: unknown): boolean => value === 1 || value === true;
const intFromBool = (value: boolean | undefined): number => (value ? 1 : 0);

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    // A corrupt blob must not take a whole screen down with it.
    return fallback;
  }
}

/** Drop `undefined` keys so `exactOptionalPropertyTypes` stays satisfied. */
function compact<T extends Record<string, unknown>>(object: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export interface VehicleRow {
  id: string;
  user_id: string;
  nickname: string;
  make: string;
  model: string;
  variant: string | null;
  model_year: number | null;
  body_type: string | null;
  colour: string | null;
  engine_type: string | null;
  engine_displacement_cc: number | null;
  cylinders: number | null;
  transmission: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  fuel_tank_capacity_l: number | null;
  recommended_fuel_grade: string | null;
  battery_json: string | null;
  tyre_json: string | null;
  vin: string | null;
  engine_number: string | null;
  plate_number: string | null;
  registration_number: string | null;
  registration_country: string | null;
  purchased_at: string | null;
  purchase_price: number | null;
  purchase_odometer_km: number | null;
  currency: string;
  dealer_name: string | null;
  dealer_contact: string | null;
  financing_json: string | null;
  warranty_json: string | null;
  current_odometer_km: number;
  odometer_updated_at: string | null;
  photo_attachment_id: string | null;
  is_primary: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toVehicle(row: VehicleRow): Vehicle {
  return compact({
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    make: row.make,
    model: row.model,
    variant: row.variant,
    modelYear: row.model_year,
    bodyType: row.body_type,
    colour: row.colour,
    engineType: row.engine_type,
    engineDisplacementCc: row.engine_displacement_cc,
    cylinders: row.cylinders,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    fuelType: row.fuel_type,
    fuelTankCapacityL: row.fuel_tank_capacity_l,
    recommendedFuelGrade: row.recommended_fuel_grade,
    batterySpecification: parseJson(row.battery_json, undefined),
    tyreSpecification: parseJson(row.tyre_json, undefined),
    vin: row.vin,
    engineNumber: row.engine_number,
    plateNumber: row.plate_number,
    registrationNumber: row.registration_number,
    registrationCountry: row.registration_country,
    purchasedAt: row.purchased_at,
    purchasePrice: row.purchase_price,
    purchaseOdometerKm: row.purchase_odometer_km,
    currency: row.currency,
    dealerName: row.dealer_name,
    dealerContact: row.dealer_contact,
    financing: parseJson(row.financing_json, undefined),
    warranty: parseJson(row.warranty_json, undefined),
    currentOdometerKm: row.current_odometer_km,
    odometerUpdatedAt: row.odometer_updated_at,
    photoAttachmentId: row.photo_attachment_id,
    isPrimary: bool(row.is_primary),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }) as Vehicle;
}

// ---------------------------------------------------------------------------
// Fuel
// ---------------------------------------------------------------------------

export interface FuelRow {
  id: string;
  vehicle_id: string;
  filled_at: string;
  odometer_km: number;
  litres: number;
  total_cost: number;
  currency: string;
  fuel_type: string;
  fuel_grade: string | null;
  is_full_tank: number;
  missed_fill: number;
  station_name: string | null;
  station_brand: string | null;
  payment_method: string | null;
  notes: string | null;
}

export function toFuelRecord(row: FuelRow): FuelRecord {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    filledAt: row.filled_at,
    odometerKm: row.odometer_km,
    litres: row.litres,
    totalCost: row.total_cost,
    currency: row.currency,
    fuelType: row.fuel_type,
    fuelGrade: row.fuel_grade,
    isFullTank: bool(row.is_full_tank),
    missedFill: bool(row.missed_fill),
    stationName: row.station_name,
    stationBrand: row.station_brand,
    paymentMethod: row.payment_method,
    notes: row.notes,
  }) as FuelRecord;
}

export function fromFuelRecord(record: FuelRecord): Record<string, unknown> {
  return {
    id: record.id,
    vehicle_id: record.vehicleId,
    filled_at: record.filledAt,
    odometer_km: record.odometerKm,
    litres: record.litres,
    total_cost: record.totalCost,
    currency: record.currency,
    fuel_type: record.fuelType,
    fuel_grade: record.fuelGrade ?? null,
    is_full_tank: intFromBool(record.isFullTank),
    missed_fill: intFromBool(record.missedFill),
    station_name: record.stationName ?? null,
    station_brand: record.stationBrand ?? null,
    payment_method: record.paymentMethod ?? null,
    notes: record.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export interface MaintenanceRow {
  id: string;
  vehicle_id: string;
  category: string;
  title: string | null;
  serviced_at: string;
  odometer_km: number;
  provider_name: string | null;
  provider_contact: string | null;
  parts_cost: number;
  labour_cost: number;
  tax_cost: number;
  total_cost: number;
  currency: string;
  parts_replaced_json: string | null;
  warranty_months: number | null;
  warranty_distance_km: number | null;
  next_service_date: string | null;
  next_service_odometer: number | null;
  notes: string | null;
}

export function toMaintenanceRecord(row: MaintenanceRow): MaintenanceRecord {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    title: row.title,
    servicedAt: row.serviced_at,
    odometerKm: row.odometer_km,
    providerName: row.provider_name,
    providerContact: row.provider_contact,
    partsCost: row.parts_cost,
    labourCost: row.labour_cost,
    taxCost: row.tax_cost,
    totalCost: row.total_cost,
    currency: row.currency,
    partsReplaced: parseJson<string[] | undefined>(row.parts_replaced_json, undefined),
    warrantyMonths: row.warranty_months,
    warrantyDistanceKm: row.warranty_distance_km,
    nextServiceDate: row.next_service_date,
    nextServiceOdometerKm: row.next_service_odometer,
    notes: row.notes,
  }) as MaintenanceRecord;
}

export interface ScheduleRow {
  id: string;
  vehicle_id: string;
  category: string;
  title: string;
  interval_months: number | null;
  interval_distance_km: number | null;
  last_serviced_at: string | null;
  last_service_odometer: number | null;
  lead_time_days: number | null;
  lead_time_km: number | null;
  enabled: number;
  notes: string | null;
}

export function toSchedule(row: ScheduleRow): MaintenanceSchedule {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    title: row.title,
    intervalMonths: row.interval_months,
    intervalDistanceKm: row.interval_distance_km,
    lastServicedAt: row.last_serviced_at,
    lastServiceOdometerKm: row.last_service_odometer,
    leadTimeDays: row.lead_time_days,
    leadTimeKm: row.lead_time_km,
    enabled: bool(row.enabled),
    notes: row.notes,
  }) as MaintenanceSchedule;
}

export interface ComponentRow {
  id: string;
  vehicle_id: string;
  kind: string;
  label: string | null;
  brand: string | null;
  model: string | null;
  specification: string | null;
  installed_at: string;
  installed_odometer_km: number;
  purchase_price: number | null;
  currency: string | null;
  expected_life_months: number | null;
  expected_life_km: number | null;
  warranty_expires_at: string | null;
  warranty_distance_km: number | null;
  rotation_interval_km: number | null;
  last_rotated_odometer: number | null;
  removed_at: string | null;
  removed_odometer_km: number | null;
  notes: string | null;
}

export function toComponent(row: ComponentRow): VehicleComponent {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    kind: row.kind,
    label: row.label,
    brand: row.brand,
    model: row.model,
    specification: row.specification,
    installedAt: row.installed_at,
    installedOdometerKm: row.installed_odometer_km,
    purchasePrice: row.purchase_price,
    currency: row.currency,
    expectedLifeMonths: row.expected_life_months,
    expectedLifeKm: row.expected_life_km,
    warrantyExpiresAt: row.warranty_expires_at,
    warrantyDistanceKm: row.warranty_distance_km,
    rotationIntervalKm: row.rotation_interval_km,
    lastRotatedOdometerKm: row.last_rotated_odometer,
    removedAt: row.removed_at,
    removedOdometerKm: row.removed_odometer_km,
    notes: row.notes,
  }) as VehicleComponent;
}

// ---------------------------------------------------------------------------
// Documents, expenses, odometer
// ---------------------------------------------------------------------------

export interface DocumentRow {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  type: string;
  title: string;
  document_number: string | null;
  issuer: string | null;
  issued_at: string | null;
  expires_at: string | null;
  notes: string | null;
  reminder_offsets_json: string | null;
  reminder_enabled: number;
  archived_at: string | null;
}

export function toDocument(row: DocumentRow): VehicleDocument {
  return compact({
    id: row.id,
    userId: row.user_id,
    vehicleId: row.vehicle_id,
    type: row.type,
    title: row.title,
    documentNumber: row.document_number,
    issuer: row.issuer,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    notes: row.notes,
    reminderOffsetsDays: parseJson<number[] | undefined>(row.reminder_offsets_json, undefined),
    reminderEnabled: bool(row.reminder_enabled),
    archivedAt: row.archived_at,
  }) as VehicleDocument;
}

export interface ExpenseRow {
  id: string;
  vehicle_id: string;
  category: string;
  title: string | null;
  amount: number;
  currency: string;
  incurred_at: string;
  odometer_km: number | null;
  vendor: string | null;
  notes: string | null;
  source: string;
  source_id: string | null;
  recurrence_id: string | null;
}

export function toExpense(row: ExpenseRow): Expense {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    incurredAt: row.incurred_at,
    odometerKm: row.odometer_km,
    vendor: row.vendor,
    notes: row.notes,
    source: row.source,
    sourceId: row.source_id,
    recurrenceId: row.recurrence_id,
  }) as Expense;
}

export interface OdometerRow {
  id: string;
  vehicle_id: string;
  odometer_km: number;
  recorded_at: string;
  source: string;
  source_id: string | null;
  notes: string | null;
}

export function toOdometerReading(row: OdometerRow): OdometerReading {
  return compact({
    id: row.id,
    vehicleId: row.vehicle_id,
    odometerKm: row.odometer_km,
    recordedAt: row.recorded_at,
    source: row.source,
    sourceId: row.source_id,
    notes: row.notes,
  }) as OdometerReading;
}
