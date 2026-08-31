import type { Expense } from './types.js';
import type { FuelRecord } from '../fuel/types.js';
import type { MaintenanceRecord } from '../maintenance/types.js';
import { MAINTENANCE_CATEGORY_LABEL } from '../maintenance/defaults.js';
import type { ExpenseCategory } from './types.js';

/**
 * Maintenance categories that most people think of as a repair rather than
 * scheduled upkeep. Splitting them matters because "am I spending more on
 * breakdowns than on servicing?" is one of the questions the analytics screen
 * exists to answer.
 */
const REPAIR_CATEGORIES = new Set(['repair', 'bodywork']);
const TYRE_CATEGORIES = new Set(['tyres']);

function categoriseMaintenance(record: MaintenanceRecord): ExpenseCategory {
  if (REPAIR_CATEGORIES.has(record.category)) return 'repair';
  if (TYRE_CATEGORIES.has(record.category)) return 'tyres';
  if (record.category === 'inspection') return 'inspection';
  return 'maintenance';
}

/**
 * Project fuel and maintenance records into the unified expense stream.
 *
 * Manual expenses that already point at a source record (`sourceId`) are
 * dropped in favour of the projection, so a user who logs a fill-up *and*
 * files the receipt as an expense still sees one cost, not two. This is the
 * single place that de-duplication happens; every total in the product is built
 * from the output of this function so they cannot disagree with each other.
 */
export function projectExpenses(input: {
  readonly fuelRecords?: readonly FuelRecord[];
  readonly maintenanceRecords?: readonly MaintenanceRecord[];
  readonly manualExpenses?: readonly Expense[];
}): Expense[] {
  const { fuelRecords = [], maintenanceRecords = [], manualExpenses = [] } = input;

  const projectedSourceIds = new Set<string>([
    ...fuelRecords.map((r) => r.id),
    ...maintenanceRecords.map((r) => r.id),
  ]);

  const fuelExpenses: Expense[] = fuelRecords.map((record) => ({
    id: `fuel:${record.id}`,
    vehicleId: record.vehicleId,
    category: 'fuel',
    title: record.stationName ?? 'Fuel',
    amount: record.totalCost,
    currency: record.currency,
    incurredAt: record.filledAt,
    ...(record.odometerKm !== undefined ? { odometerKm: record.odometerKm } : {}),
    ...(record.stationName ? { vendor: record.stationName } : {}),
    source: 'fuel_record',
    sourceId: record.id,
    ...(record.attachmentIds ? { attachmentIds: record.attachmentIds } : {}),
  }));

  const maintenanceExpenses: Expense[] = maintenanceRecords.map((record) => ({
    id: `maintenance:${record.id}`,
    vehicleId: record.vehicleId,
    category: categoriseMaintenance(record),
    title: record.title ?? MAINTENANCE_CATEGORY_LABEL[record.category],
    amount: record.totalCost,
    currency: record.currency,
    incurredAt: record.servicedAt,
    ...(record.odometerKm !== undefined ? { odometerKm: record.odometerKm } : {}),
    ...(record.providerName ? { vendor: record.providerName } : {}),
    source: 'maintenance_record',
    sourceId: record.id,
    ...(record.attachmentIds ? { attachmentIds: record.attachmentIds } : {}),
  }));

  const standaloneManual = manualExpenses.filter(
    (expense) => !expense.sourceId || !projectedSourceIds.has(expense.sourceId),
  );

  return [...fuelExpenses, ...maintenanceExpenses, ...standaloneManual].sort(
    (a, b) => new Date(a.incurredAt).getTime() - new Date(b.incurredAt).getTime(),
  );
}
