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
import { createRepository } from './repository';
import {
  toComponent,
  toDocument,
  toExpense,
  toFuelRecord,
  toMaintenanceRecord,
  toOdometerReading,
  toSchedule,
  toVehicle,
  fromFuelRecord,
  type ComponentRow,
  type DocumentRow,
  type ExpenseRow,
  type FuelRow,
  type MaintenanceRow,
  type OdometerRow,
  type ScheduleRow,
  type VehicleRow,
} from '../db/mappers';

/** Serialise optional structured fields; `undefined` becomes SQL NULL. */
const json = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);
const flag = (value: boolean | undefined): number => (value ? 1 : 0);

export const vehicleRepository = createRepository<VehicleRow, Vehicle>({
  table: 'vehicles',
  entity: 'vehicle',
  toDomain: toVehicle,
  toRow: (v) => ({
    id: v.id,
    user_id: v.userId,
    nickname: v.nickname,
    make: v.make,
    model: v.model,
    variant: v.variant ?? null,
    model_year: v.modelYear ?? null,
    body_type: v.bodyType ?? null,
    colour: v.colour ?? null,
    engine_type: v.engineType ?? null,
    engine_displacement_cc: v.engineDisplacementCc ?? null,
    cylinders: v.cylinders ?? null,
    transmission: v.transmission ?? null,
    drivetrain: v.drivetrain ?? null,
    fuel_type: v.fuelType ?? null,
    fuel_tank_capacity_l: v.fuelTankCapacityL ?? null,
    recommended_fuel_grade: v.recommendedFuelGrade ?? null,
    battery_json: json(v.batterySpecification),
    tyre_json: json(v.tyreSpecification),
    vin: v.vin ?? null,
    engine_number: v.engineNumber ?? null,
    plate_number: v.plateNumber ?? null,
    registration_number: v.registrationNumber ?? null,
    registration_country: v.registrationCountry ?? null,
    purchased_at: v.purchasedAt ?? null,
    purchase_price: v.purchasePrice ?? null,
    purchase_odometer_km: v.purchaseOdometerKm ?? null,
    currency: v.currency,
    dealer_name: v.dealerName ?? null,
    dealer_contact: v.dealerContact ?? null,
    financing_json: json(v.financing),
    warranty_json: json(v.warranty),
    current_odometer_km: v.currentOdometerKm,
    odometer_updated_at: v.odometerUpdatedAt ?? null,
    photo_attachment_id: v.photoAttachmentId ?? null,
    is_primary: flag(v.isPrimary),
    archived_at: v.archivedAt ?? null,
  }),
});

export const fuelRepository = createRepository<FuelRow, FuelRecord>({
  table: 'fuel_records',
  entity: 'fuel_record',
  toDomain: toFuelRecord,
  toRow: fromFuelRecord,
});

export const maintenanceRepository = createRepository<MaintenanceRow, MaintenanceRecord>({
  table: 'maintenance_records',
  entity: 'maintenance_record',
  toDomain: toMaintenanceRecord,
  toRow: (r) => ({
    id: r.id,
    vehicle_id: r.vehicleId,
    category: r.category,
    title: r.title ?? null,
    serviced_at: r.servicedAt,
    odometer_km: r.odometerKm,
    provider_name: r.providerName ?? null,
    provider_contact: r.providerContact ?? null,
    parts_cost: r.partsCost,
    labour_cost: r.labourCost,
    tax_cost: r.taxCost,
    total_cost: r.totalCost,
    currency: r.currency,
    parts_replaced_json: json(r.partsReplaced),
    warranty_months: r.warrantyMonths ?? null,
    warranty_distance_km: r.warrantyDistanceKm ?? null,
    next_service_date: r.nextServiceDate ?? null,
    next_service_odometer: r.nextServiceOdometerKm ?? null,
    notes: r.notes ?? null,
  }),
});

export const scheduleRepository = createRepository<ScheduleRow, MaintenanceSchedule>({
  table: 'maintenance_schedules',
  entity: 'maintenance_schedule',
  toDomain: toSchedule,
  toRow: (s) => ({
    id: s.id,
    vehicle_id: s.vehicleId,
    category: s.category,
    title: s.title,
    interval_months: s.intervalMonths ?? null,
    interval_distance_km: s.intervalDistanceKm ?? null,
    last_serviced_at: s.lastServicedAt ?? null,
    last_service_odometer: s.lastServiceOdometerKm ?? null,
    lead_time_days: s.leadTimeDays ?? null,
    lead_time_km: s.leadTimeKm ?? null,
    enabled: flag(s.enabled),
    notes: s.notes ?? null,
  }),
});

export const componentRepository = createRepository<ComponentRow, VehicleComponent>({
  table: 'vehicle_components',
  entity: 'vehicle_component',
  toDomain: toComponent,
  toRow: (c) => ({
    id: c.id,
    vehicle_id: c.vehicleId,
    kind: c.kind,
    label: c.label ?? null,
    brand: c.brand ?? null,
    model: c.model ?? null,
    specification: c.specification ?? null,
    installed_at: c.installedAt,
    installed_odometer_km: c.installedOdometerKm,
    purchase_price: c.purchasePrice ?? null,
    currency: c.currency ?? null,
    expected_life_months: c.expectedLifeMonths ?? null,
    expected_life_km: c.expectedLifeKm ?? null,
    warranty_expires_at: c.warrantyExpiresAt ?? null,
    warranty_distance_km: c.warrantyDistanceKm ?? null,
    rotation_interval_km: c.rotationIntervalKm ?? null,
    last_rotated_odometer: c.lastRotatedOdometerKm ?? null,
    removed_at: c.removedAt ?? null,
    removed_odometer_km: c.removedOdometerKm ?? null,
    notes: c.notes ?? null,
  }),
});

export const documentRepository = createRepository<DocumentRow, VehicleDocument>({
  table: 'documents',
  entity: 'document',
  toDomain: toDocument,
  toRow: (d) => ({
    id: d.id,
    user_id: d.userId,
    vehicle_id: d.vehicleId ?? null,
    type: d.type,
    title: d.title,
    document_number: d.documentNumber ?? null,
    issuer: d.issuer ?? null,
    issued_at: d.issuedAt ?? null,
    expires_at: d.expiresAt ?? null,
    notes: d.notes ?? null,
    reminder_offsets_json: json(d.reminderOffsetsDays),
    reminder_enabled: flag(d.reminderEnabled),
    archived_at: d.archivedAt ?? null,
  }),
});

export const expenseRepository = createRepository<ExpenseRow, Expense>({
  table: 'expenses',
  entity: 'expense',
  toDomain: toExpense,
  toRow: (e) => ({
    id: e.id,
    vehicle_id: e.vehicleId,
    category: e.category,
    title: e.title ?? null,
    amount: e.amount,
    currency: e.currency,
    incurred_at: e.incurredAt,
    odometer_km: e.odometerKm ?? null,
    vendor: e.vendor ?? null,
    notes: e.notes ?? null,
    source: e.source,
    source_id: e.sourceId ?? null,
    recurrence_id: e.recurrenceId ?? null,
  }),
});

export const odometerRepository = createRepository<OdometerRow, OdometerReading>({
  table: 'odometer_readings',
  entity: 'odometer_reading',
  toDomain: toOdometerReading,
  toRow: (o) => ({
    id: o.id,
    vehicle_id: o.vehicleId,
    odometer_km: o.odometerKm,
    recorded_at: o.recordedAt,
    source: o.source,
    source_id: o.sourceId ?? null,
    notes: o.notes ?? null,
  }),
});

/** Everything the sync engine iterates over, in dependency order. */
export const ALL_REPOSITORIES = [
  vehicleRepository,
  fuelRepository,
  maintenanceRepository,
  scheduleRepository,
  componentRepository,
  documentRepository,
  expenseRepository,
  odometerRepository,
] as const;

export * from './repository';
