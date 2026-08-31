import { monthKey, type IsoDateTime, type Kilometres, type Money } from '../common/types.js';
import { detectEfficiencyAnomaly, type EfficiencyAnomaly } from '../fuel/anomaly.js';
import { analyseConsumption, averageDailyDistance } from '../fuel/consumption.js';
import {
  computeFuelStatistics,
  efficiencyTrend,
  monthlyFuelSeries,
  type EfficiencyTrend,
  type FuelStatistics,
  type MonthlyFuelPoint,
} from '../fuel/statistics.js';
import type { FuelRecord } from '../fuel/types.js';
import {
  evaluateComponents,
  type ComponentEvaluation,
  type VehicleComponent,
} from '../maintenance/components.js';
import { evaluateSchedules } from '../maintenance/intervals.js';
import type {
  MaintenanceRecord,
  MaintenanceSchedule,
  ScheduleEvaluation,
} from '../maintenance/types.js';
import { evaluateDocuments } from '../documents/expiry.js';
import type { DocumentEvaluation, VehicleDocument } from '../documents/types.js';
import { projectExpenses } from '../expenses/projection.js';
import { expensesInRange, summariseExpenses, type ExpenseSummary } from '../expenses/summary.js';
import type { Expense } from '../expenses/types.js';
import { vehicleDisplayName, vehicleSubtitle } from '../vehicle/profile.js';
import type { Vehicle } from '../vehicle/types.js';
import type { FuelEconomyStandard, FuelEfficiency } from '../units/units.js';
import { computeVehicleHealth, type VehicleHealth } from './health.js';
import { buildOwnershipInsights, type OwnershipInsight } from './insights.js';

export interface DashboardInput {
  readonly now: IsoDateTime | Date;
  readonly vehicle: Vehicle;
  readonly fuelRecords?: readonly FuelRecord[];
  readonly maintenanceRecords?: readonly MaintenanceRecord[];
  readonly schedules?: readonly MaintenanceSchedule[];
  readonly components?: readonly VehicleComponent[];
  readonly documents?: readonly VehicleDocument[];
  readonly manualExpenses?: readonly Expense[];
  readonly economyStandard: FuelEconomyStandard;
}

export interface ActivityItem {
  readonly id: string;
  readonly type: 'fuel' | 'maintenance' | 'expense' | 'document';
  readonly title: string;
  readonly subtitle: string;
  readonly occurredAt: IsoDateTime;
  readonly amount?: Money;
  readonly deepLink: string;
}

/**
 * Everything the home screen needs, computed once.
 *
 * The dashboard is the most calculation-dense screen in the product, and every
 * figure on it has to agree with every other one — the month's fuel cost must
 * be the same number whether it is read from the fuel tile or the expense
 * breakdown. Composing it here, from the same projections, makes that
 * agreement structural instead of something the UI has to be careful about.
 *
 * Pure and synchronous: the screen renders this from local data with no network
 * round-trip, which is what makes the app work offline without a second code
 * path.
 */
export interface DashboardViewModel {
  readonly vehicleId: string;
  readonly displayName: string;
  readonly subtitle: string;
  readonly photoAttachmentId: string | null;
  readonly currentOdometerKm: Kilometres;

  readonly averageEfficiency: FuelEfficiency;
  readonly recentEfficiency: FuelEfficiency;
  readonly efficiencyTrend: EfficiencyTrend;
  readonly fuelAnomaly: EfficiencyAnomaly;

  readonly monthFuelCost: Money;
  readonly monthDistanceKm: Kilometres;
  readonly monthMaintenanceCost: Money;
  readonly monthTotalCost: Money;
  readonly lifetimeCost: Money;
  readonly costPerKm: Money | null;

  readonly health: VehicleHealth;
  readonly upcomingMaintenance: readonly ScheduleEvaluation[];
  readonly expiringDocuments: readonly DocumentEvaluation[];
  readonly wearItems: readonly ComponentEvaluation[];
  readonly recentActivity: readonly ActivityItem[];
  readonly insights: readonly OwnershipInsight[];

  readonly fuel: FuelStatistics;
  readonly expenses: ExpenseSummary;
  readonly monthlyFuel: readonly MonthlyFuelPoint[];
  /** Distance derived from the fuel log, used for date projections. */
  readonly averageDailyDistanceKm: number | null;
}

export function buildDashboard(input: DashboardInput): DashboardViewModel {
  const now = input.now instanceof Date ? input.now : new Date(input.now);
  const {
    vehicle,
    fuelRecords = [],
    maintenanceRecords = [],
    schedules = [],
    components = [],
    documents = [],
    manualExpenses = [],
  } = input;

  // --- Fuel --------------------------------------------------------------
  const { segments } = analyseConsumption(fuelRecords);
  const fuel = computeFuelStatistics(fuelRecords, vehicle.currency);
  const trend = efficiencyTrend(segments, input.economyStandard);
  const dailyKm = averageDailyDistance(fuelRecords);
  const anomaly = detectEfficiencyAnomaly(segments, { recentMonth: now.getUTCMonth() });

  // --- Costs -------------------------------------------------------------
  const allExpenses = projectExpenses({ fuelRecords, maintenanceRecords, manualExpenses });
  const expenses = summariseExpenses(allExpenses, vehicle.currency);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const thisMonth = expensesInRange(allExpenses, monthStart, nextMonthStart);

  const monthFuelCost = thisMonth
    .filter((e) => e.category === 'fuel')
    .reduce((acc, e) => acc + e.amount, 0);
  const monthMaintenanceCost = thisMonth
    .filter((e) => e.category === 'maintenance' || e.category === 'repair')
    .reduce((acc, e) => acc + e.amount, 0);
  const monthTotalCost = thisMonth.reduce((acc, e) => acc + e.amount, 0);

  const monthDistanceKm = segments
    .filter((s) => monthKey(s.endedAt) === monthKey(now))
    .reduce((acc, s) => acc + s.distanceKm, 0);

  // Cost per km uses measured distance, the only distance we can vouch for.
  const costPerKm = fuel.measuredDistanceKm > 0 ? expenses.total / fuel.measuredDistanceKm : null;

  // --- Status ------------------------------------------------------------
  const scheduleEvaluations = evaluateSchedules(schedules, {
    now,
    currentOdometerKm: vehicle.currentOdometerKm,
    averageDailyDistanceKm: dailyKm,
  });

  const componentEvaluations = evaluateComponents(components, {
    now,
    currentOdometerKm: vehicle.currentOdometerKm,
    averageDailyDistanceKm: dailyKm,
  });

  const documentEvaluations = evaluateDocuments(documents, now);

  const health = computeVehicleHealth({
    schedules: scheduleEvaluations,
    documents: documentEvaluations,
    components: componentEvaluations,
    fuelAnomaly: anomaly,
  });

  return {
    vehicleId: vehicle.id,
    displayName: vehicleDisplayName(vehicle),
    subtitle: vehicleSubtitle(vehicle),
    photoAttachmentId: vehicle.photoAttachmentId ?? null,
    currentOdometerKm: vehicle.currentOdometerKm,

    averageEfficiency: fuel.averageEfficiency,
    recentEfficiency: trend.recent,
    efficiencyTrend: trend,
    fuelAnomaly: anomaly,

    monthFuelCost,
    monthDistanceKm,
    monthMaintenanceCost,
    monthTotalCost,
    lifetimeCost: expenses.total,
    costPerKm,

    health,
    // The home screen shows only what needs attention; the full list lives one
    // tap away on the maintenance tab.
    upcomingMaintenance: scheduleEvaluations
      .filter((s) => s.status === 'overdue' || s.status === 'due' || s.status === 'due_soon')
      .slice(0, 4),
    expiringDocuments: documentEvaluations
      .filter((d) => d.status === 'expired' || d.status === 'expiring_soon')
      .slice(0, 4),
    wearItems: componentEvaluations
      .filter((c) => c.status !== 'ok' && c.status !== 'unknown')
      .slice(0, 4),
    recentActivity: buildRecentActivity(allExpenses, vehicle.id, 8),
    insights: buildOwnershipInsights({
      now,
      vehicleId: vehicle.id,
      expenses,
      fuel,
      efficiencyTrend: trend,
      schedules: scheduleEvaluations,
      totalDistanceKm: fuel.measuredDistanceKm || fuel.loggedDistanceKm,
    }),

    fuel,
    expenses,
    monthlyFuel: monthlyFuelSeries(fuelRecords),
    averageDailyDistanceKm: dailyKm,
  };
}

function buildRecentActivity(
  expenses: readonly Expense[],
  vehicleId: string,
  limit: number,
): ActivityItem[] {
  return [...expenses]
    .sort((a, b) => new Date(b.incurredAt).getTime() - new Date(a.incurredAt).getTime())
    .slice(0, limit)
    .map((expense) => ({
      id: expense.id,
      type:
        expense.source === 'fuel_record'
          ? ('fuel' as const)
          : expense.source === 'maintenance_record'
            ? ('maintenance' as const)
            : ('expense' as const),
      title: expense.title ?? 'Expense',
      subtitle: expense.vendor ?? '',
      occurredAt: expense.incurredAt,
      amount: expense.amount,
      deepLink:
        expense.source === 'fuel_record'
          ? `carbuddy://vehicle/${vehicleId}/fuel/${expense.sourceId}`
          : expense.source === 'maintenance_record'
            ? `carbuddy://vehicle/${vehicleId}/maintenance/record/${expense.sourceId}`
            : `carbuddy://vehicle/${vehicleId}/expenses/${expense.id}`,
    }));
}
