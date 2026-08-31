import {
  buildDashboard,
  type DashboardViewModel,
  type Expense,
  type FuelEconomyStandard,
  type FuelRecord,
  type MaintenanceRecord,
  type MaintenanceSchedule,
  type Vehicle,
  type VehicleComponent,
  type VehicleDocument,
} from '@carbuddy/domain';
import {
  componentRepository,
  documentRepository,
  expenseRepository,
  fuelRepository,
  maintenanceRepository,
  scheduleRepository,
  vehicleRepository,
} from './repositories';

/**
 * Read paths used by the screens.
 *
 * These are thin: they load rows and hand them to `@carbuddy/domain`, which
 * does every calculation. No arithmetic happens in this file, and none happens
 * in a component — that separation is what keeps the numbers testable without a
 * device and identical to the ones the server computes.
 */

export async function listVehicles(userId: string): Promise<Vehicle[]> {
  return vehicleRepository.list({
    where: 'user_id = ? AND archived_at IS NULL',
    params: [userId],
    orderBy: 'is_primary DESC, nickname COLLATE NOCASE ASC',
  });
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  return vehicleRepository.get(vehicleId);
}

export async function listFuelRecords(vehicleId: string, limit?: number): Promise<FuelRecord[]> {
  return fuelRepository.list({
    where: 'vehicle_id = ?',
    params: [vehicleId],
    orderBy: 'filled_at DESC, odometer_km DESC',
    ...(limit !== undefined ? { limit } : {}),
  });
}

export async function listMaintenanceRecords(
  vehicleId: string,
  limit?: number,
): Promise<MaintenanceRecord[]> {
  return maintenanceRepository.list({
    where: 'vehicle_id = ?',
    params: [vehicleId],
    orderBy: 'serviced_at DESC',
    ...(limit !== undefined ? { limit } : {}),
  });
}

export async function listSchedules(vehicleId: string): Promise<MaintenanceSchedule[]> {
  return scheduleRepository.list({
    where: 'vehicle_id = ?',
    params: [vehicleId],
    orderBy: 'title COLLATE NOCASE ASC',
  });
}

export async function listComponents(vehicleId: string): Promise<VehicleComponent[]> {
  return componentRepository.list({
    where: 'vehicle_id = ? AND removed_at IS NULL',
    params: [vehicleId],
    orderBy: 'installed_at DESC',
  });
}

/**
 * Documents visible for a vehicle.
 *
 * Includes driver-level documents (a licence has no `vehicle_id`) because they
 * expire too and the user thinks of them as part of "my documents", not as
 * belonging to one car.
 */
export async function listDocuments(
  userId: string,
  vehicleId?: string,
): Promise<VehicleDocument[]> {
  return documentRepository.list({
    where: vehicleId
      ? 'user_id = ? AND (vehicle_id = ? OR vehicle_id IS NULL) AND archived_at IS NULL'
      : 'user_id = ? AND archived_at IS NULL',
    params: vehicleId ? [userId, vehicleId] : [userId],
    orderBy: 'expires_at IS NULL, expires_at ASC',
  });
}

export async function listManualExpenses(vehicleId: string): Promise<Expense[]> {
  return expenseRepository.list({
    where: "vehicle_id = ? AND source = 'manual'",
    params: [vehicleId],
    orderBy: 'incurred_at DESC',
  });
}

export interface DashboardQueryOptions {
  vehicleId: string;
  userId: string;
  economyStandard: FuelEconomyStandard;
  now?: Date;
}

/**
 * Load and compute the whole home screen.
 *
 * Reads run in parallel — they are independent SQLite queries against a WAL
 * database — then a single pure domain call turns them into the view model.
 * On a typical log this is a few milliseconds, which is why the dashboard can
 * render synchronously offline instead of showing a spinner.
 */
export async function loadDashboard(
  options: DashboardQueryOptions,
): Promise<DashboardViewModel | null> {
  const vehicle = await getVehicle(options.vehicleId);
  if (!vehicle) return null;

  const [fuelRecords, maintenanceRecords, schedules, components, documents, manualExpenses] =
    await Promise.all([
      listFuelRecords(options.vehicleId),
      listMaintenanceRecords(options.vehicleId),
      listSchedules(options.vehicleId),
      listComponents(options.vehicleId),
      listDocuments(options.userId, options.vehicleId),
      listManualExpenses(options.vehicleId),
    ]);

  return buildDashboard({
    now: options.now ?? new Date(),
    vehicle,
    fuelRecords,
    maintenanceRecords,
    schedules,
    components,
    documents,
    manualExpenses,
    economyStandard: options.economyStandard,
  });
}
