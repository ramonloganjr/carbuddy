import { Injectable, NotFoundException } from '@nestjs/common';
import {
  analyseConsumption,
  averageDailyDistance,
  buildOwnershipInsights,
  computeFuelStatistics,
  computeVehicleHealth,
  detectEfficiencyAnomaly,
  efficiencyTrend,
  evaluateComponents,
  evaluateDocuments,
  evaluateSchedules,
  monthlyFuelSeries,
  projectExpenses,
  summariseExpenses,
  type FuelEconomyStandard,
  type FuelRecord,
  type MaintenanceRecord,
  type MaintenanceSchedule,
  type VehicleComponent,
  type VehicleDocument,
} from '@carbuddy/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber, toOptionalNumber } from '../../common/decimal';

/**
 * Server-side analytics.
 *
 * Every figure here comes from the *same* `@carbuddy/domain` functions the
 * mobile app runs locally. That is the point of the shared package: the server
 * can render a report or decide whether to send a push notification, and its
 * numbers cannot drift from what the user sees in the app, because there is
 * only one implementation.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async vehicleOverview(
    userId: string,
    vehicleId: string,
    economyStandard: FuelEconomyStandard = 'km_l',
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const [fuelRows, maintenanceRows, scheduleRows, componentRows, documentRows, expenseRows] =
      await Promise.all([
        this.prisma.fuelRecord.findMany({
          where: { vehicleId, deletedAt: null },
          orderBy: { odometerKm: 'asc' },
        }),
        this.prisma.maintenanceRecord.findMany({ where: { vehicleId, deletedAt: null } }),
        this.prisma.maintenanceSchedule.findMany({ where: { vehicleId, deletedAt: null } }),
        this.prisma.vehicleComponent.findMany({
          where: { vehicleId, deletedAt: null, removedAt: null },
        }),
        this.prisma.document.findMany({
          where: { userId, deletedAt: null, OR: [{ vehicleId }, { vehicleId: null }] },
        }),
        this.prisma.expense.findMany({
          where: { vehicleId, deletedAt: null, source: 'manual' },
        }),
      ]);

    const fuelRecords: FuelRecord[] = fuelRows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      filledAt: row.filledAt.toISOString(),
      odometerKm: toNumber(row.odometerKm),
      litres: toNumber(row.litres),
      totalCost: row.totalCost,
      currency: row.currency,
      fuelType: row.fuelType as FuelRecord['fuelType'],
      isFullTank: row.isFullTank,
      missedFill: row.missedFill,
      ...(row.stationName ? { stationName: row.stationName } : {}),
    }));

    const maintenanceRecords: MaintenanceRecord[] = maintenanceRows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      category: row.category as MaintenanceRecord['category'],
      ...(row.title ? { title: row.title } : {}),
      servicedAt: row.servicedAt.toISOString(),
      odometerKm: toNumber(row.odometerKm),
      ...(row.providerName ? { providerName: row.providerName } : {}),
      partsCost: row.partsCost,
      labourCost: row.labourCost,
      taxCost: row.taxCost,
      totalCost: row.totalCost,
      currency: row.currency,
    }));

    const schedules: MaintenanceSchedule[] = scheduleRows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      category: row.category as MaintenanceSchedule['category'],
      title: row.title,
      ...(row.intervalMonths !== null ? { intervalMonths: row.intervalMonths } : {}),
      ...(row.intervalDistanceKm !== null
        ? { intervalDistanceKm: toNumber(row.intervalDistanceKm) }
        : {}),
      ...(row.lastServicedAt ? { lastServicedAt: row.lastServicedAt.toISOString() } : {}),
      ...(row.lastServiceOdometerKm !== null
        ? { lastServiceOdometerKm: toNumber(row.lastServiceOdometerKm) }
        : {}),
      ...(row.leadTimeDays !== null ? { leadTimeDays: row.leadTimeDays } : {}),
      ...(row.leadTimeKm !== null ? { leadTimeKm: toNumber(row.leadTimeKm) } : {}),
      enabled: row.enabled,
    }));

    const components: VehicleComponent[] = componentRows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      kind: row.kind as VehicleComponent['kind'],
      ...(row.label ? { label: row.label } : {}),
      installedAt: row.installedAt.toISOString(),
      installedOdometerKm: toNumber(row.installedOdometerKm),
      ...(row.expectedLifeMonths !== null ? { expectedLifeMonths: row.expectedLifeMonths } : {}),
      ...(row.expectedLifeKm !== null ? { expectedLifeKm: toNumber(row.expectedLifeKm) } : {}),
      ...(row.warrantyExpiresAt ? { warrantyExpiresAt: row.warrantyExpiresAt.toISOString() } : {}),
      ...(row.rotationIntervalKm !== null
        ? { rotationIntervalKm: toNumber(row.rotationIntervalKm) }
        : {}),
      ...(row.lastRotatedOdometerKm !== null
        ? { lastRotatedOdometerKm: toNumber(row.lastRotatedOdometerKm) }
        : {}),
    }));

    const documents: VehicleDocument[] = documentRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      ...(row.vehicleId ? { vehicleId: row.vehicleId } : {}),
      type: row.type as VehicleDocument['type'],
      title: row.title,
      ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
      ...(row.reminderOffsetsDays.length > 0
        ? { reminderOffsetsDays: row.reminderOffsetsDays }
        : {}),
      reminderEnabled: row.reminderEnabled,
    }));

    const manualExpenses = expenseRows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      category: row.category as 'other',
      amount: row.amount,
      currency: row.currency,
      incurredAt: row.incurredAt.toISOString(),
      ...(row.odometerKm !== null ? { odometerKm: toOptionalNumber(row.odometerKm) } : {}),
      source: 'manual' as const,
    }));

    const now = new Date();
    const { segments } = analyseConsumption(fuelRecords);
    const dailyKm = averageDailyDistance(fuelRecords);
    const fuel = computeFuelStatistics(fuelRecords, vehicle.currency);
    const trend = efficiencyTrend(segments, economyStandard);
    const anomaly = detectEfficiencyAnomaly(segments, { recentMonth: now.getUTCMonth() });

    const allExpenses = projectExpenses({ fuelRecords, maintenanceRecords, manualExpenses });
    const expenses = summariseExpenses(allExpenses, vehicle.currency);

    const context = {
      now,
      currentOdometerKm: toNumber(vehicle.currentOdometerKm),
      averageDailyDistanceKm: dailyKm,
    };

    const scheduleEvaluations = evaluateSchedules(schedules, context);
    const componentEvaluations = evaluateComponents(components, context);
    const documentEvaluations = evaluateDocuments(documents, now);

    return {
      vehicleId,
      fuel: {
        ...fuel,
        monthly: monthlyFuelSeries(fuelRecords),
        trend,
        anomaly,
      },
      expenses,
      maintenance: scheduleEvaluations,
      components: componentEvaluations,
      documents: documentEvaluations,
      health: computeVehicleHealth({
        schedules: scheduleEvaluations,
        documents: documentEvaluations,
        components: componentEvaluations,
        fuelAnomaly: anomaly,
      }),
      insights: buildOwnershipInsights({
        now,
        vehicleId,
        expenses,
        fuel,
        efficiencyTrend: trend,
        schedules: scheduleEvaluations,
        totalDistanceKm: fuel.measuredDistanceKm || fuel.loggedDistanceKm,
      }),
    };
  }
}
