import type { FuelRecord } from '../src/fuel/types.js';
import type { MaintenanceRecord, MaintenanceSchedule } from '../src/maintenance/types.js';
import type { VehicleComponent } from '../src/maintenance/components.js';
import type { VehicleDocument } from '../src/documents/types.js';
import type { Expense } from '../src/expenses/types.js';
import type { Vehicle } from '../src/vehicle/types.js';
import type { QueuedMutation, SyncableRecord } from '../src/sync/types.js';

let counter = 0;
export const nextId = (prefix = 'id') => `${prefix}-${(counter += 1)}`;
export const resetIds = () => {
  counter = 0;
};

export const VEHICLE_ID = 'vehicle-1';

export function fuelRecord(overrides: Partial<FuelRecord> = {}): FuelRecord {
  return {
    id: nextId('fuel'),
    vehicleId: VEHICLE_ID,
    filledAt: '2025-01-01T08:00:00.000Z',
    odometerKm: 10_000,
    litres: 40,
    totalCost: 6_000,
    currency: 'USD',
    fuelType: 'gasoline',
    isFullTank: true,
    ...overrides,
  };
}

/**
 * Build a realistic fill-up history.
 * Each entry advances the odometer by `distance` and buys `litres` of fuel.
 */
export function fuelSeries(
  entries: readonly {
    distance: number;
    litres: number;
    full?: boolean;
    days?: number;
    cost?: number;
  }[],
  start: { odometerKm?: number; date?: string } = {},
): FuelRecord[] {
  let odometer = start.odometerKm ?? 10_000;
  let date = new Date(start.date ?? '2025-01-01T08:00:00.000Z');
  const records: FuelRecord[] = [];

  // Opening full tank — establishes the known starting level.
  records.push(
    fuelRecord({
      odometerKm: odometer,
      filledAt: date.toISOString(),
      litres: 45,
      isFullTank: true,
    }),
  );

  for (const entry of entries) {
    odometer += entry.distance;
    date = new Date(date.getTime() + (entry.days ?? 7) * 86_400_000);
    records.push(
      fuelRecord({
        odometerKm: odometer,
        filledAt: date.toISOString(),
        litres: entry.litres,
        isFullTank: entry.full ?? true,
        totalCost: entry.cost ?? Math.round(entry.litres * 150),
      }),
    );
  }

  return records;
}

export function maintenanceRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: nextId('maint'),
    vehicleId: VEHICLE_ID,
    category: 'engine_oil',
    servicedAt: '2025-01-15T10:00:00.000Z',
    odometerKm: 10_500,
    partsCost: 4_000,
    labourCost: 3_000,
    taxCost: 700,
    totalCost: 7_700,
    currency: 'USD',
    ...overrides,
  };
}

export function schedule(overrides: Partial<MaintenanceSchedule> = {}): MaintenanceSchedule {
  return {
    id: nextId('sched'),
    vehicleId: VEHICLE_ID,
    category: 'engine_oil',
    title: 'Engine oil & filter',
    intervalMonths: 6,
    intervalDistanceKm: 10_000,
    lastServicedAt: '2025-01-01T00:00:00.000Z',
    lastServiceOdometerKm: 10_000,
    enabled: true,
    ...overrides,
  };
}

export function component(overrides: Partial<VehicleComponent> = {}): VehicleComponent {
  return {
    id: nextId('comp'),
    vehicleId: VEHICLE_ID,
    kind: 'tyre_set',
    installedAt: '2024-01-01T00:00:00.000Z',
    installedOdometerKm: 5_000,
    ...overrides,
  };
}

export function document(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: nextId('doc'),
    userId: 'user-1',
    vehicleId: VEHICLE_ID,
    type: 'insurance_policy',
    title: 'Insurance policy',
    reminderEnabled: true,
    ...overrides,
  };
}

export function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: nextId('exp'),
    vehicleId: VEHICLE_ID,
    category: 'parking',
    amount: 500,
    currency: 'USD',
    incurredAt: '2025-01-10T12:00:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

export function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: VEHICLE_ID,
    userId: 'user-1',
    nickname: 'Daily driver',
    make: 'Toyota',
    model: 'Corolla',
    modelYear: 2019,
    currency: 'USD',
    currentOdometerKm: 12_000,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function syncRecord(overrides: Partial<SyncableRecord> = {}): SyncableRecord {
  return {
    id: 'row-1',
    version: 1,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as SyncableRecord;
}

export function mutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: nextId('mut'),
    entity: 'fuel_record',
    entityId: 'fuel-1',
    operation: 'update',
    payload: {},
    baseVersion: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    attempts: 0,
    status: 'pending',
    deviceId: 'device-a',
    ...overrides,
  };
}
