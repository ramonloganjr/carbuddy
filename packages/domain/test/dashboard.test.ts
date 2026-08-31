import { beforeEach, describe, expect, it } from 'vitest';
import { buildDashboard } from '../src/analytics/dashboard.js';
import { computeVehicleHealth } from '../src/analytics/health.js';
import { evaluateSchedules } from '../src/maintenance/intervals.js';
import { evaluateDocuments } from '../src/documents/expiry.js';
import { defaultPreferences } from '../src/preferences.js';
import {
  document,
  expense,
  fuelRecord,
  fuelSeries,
  maintenanceRecord,
  resetIds,
  schedule,
  vehicle,
} from './factories.js';

beforeEach(resetIds);

const NOW = '2025-03-15T00:00:00.000Z';

describe('buildDashboard', () => {
  it('renders a brand-new vehicle without crashing or inventing numbers', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      economyStandard: 'km_l',
    });

    expect(view.displayName).toBe('Daily driver');
    expect(view.lifetimeCost).toBe(0);
    expect(view.costPerKm).toBeNull();
    expect(view.health.provisional).toBe(true);
    expect(view.insights).toEqual([]);
    expect(view.recentActivity).toEqual([]);
  });

  /**
   * The invariant that justifies computing the whole dashboard in one place:
   * the month's fuel figure must be the same number wherever it is read.
   */
  it('keeps the fuel tile and the expense breakdown in agreement', () => {
    const fuelRecords = [
      fuelRecord({
        id: 'f1',
        filledAt: '2025-03-02T00:00:00.000Z',
        odometerKm: 10_000,
        litres: 45,
        totalCost: 6_000,
      }),
      fuelRecord({
        id: 'f2',
        filledAt: '2025-03-09T00:00:00.000Z',
        odometerKm: 10_500,
        litres: 40,
        totalCost: 5_500,
      }),
      fuelRecord({
        id: 'f3',
        filledAt: '2025-02-20T00:00:00.000Z',
        odometerKm: 9_600,
        litres: 42,
        totalCost: 5_800,
      }),
    ];

    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords,
      economyStandard: 'km_l',
    });

    const marchFuelFromBreakdown =
      view.expenses.byMonth
        .find((m) => m.period === '2025-03')
        ?.byCategory.find((c) => c.category === 'fuel')?.total ?? 0;

    expect(view.monthFuelCost).toBe(11_500);
    expect(marchFuelFromBreakdown).toBe(view.monthFuelCost);
  });

  it('separates this month from lifetime cost', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      manualExpenses: [
        expense({ amount: 1_000, incurredAt: '2025-03-05T00:00:00.000Z' }),
        expense({ amount: 9_000, incurredAt: '2024-11-05T00:00:00.000Z' }),
      ],
      economyStandard: 'km_l',
    });

    expect(view.monthTotalCost).toBe(1_000);
    expect(view.lifetimeCost).toBe(10_000);
  });

  it('counts maintenance separately from fuel in the monthly tiles', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords: [fuelRecord({ filledAt: '2025-03-02T00:00:00.000Z', totalCost: 6_000 })],
      maintenanceRecords: [
        maintenanceRecord({ servicedAt: '2025-03-06T00:00:00.000Z', totalCost: 7_700 }),
      ],
      economyStandard: 'km_l',
    });

    expect(view.monthFuelCost).toBe(6_000);
    expect(view.monthMaintenanceCost).toBe(7_700);
    expect(view.monthTotalCost).toBe(13_700);
  });

  it('surfaces only maintenance that needs attention, most urgent first', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle({ currentOdometerKm: 21_000 }),
      schedules: [
        schedule({
          id: 'fine',
          title: 'Coolant',
          intervalDistanceKm: 80_000,
          intervalMonths: undefined,
        }),
        schedule({
          id: 'late',
          title: 'Oil',
          intervalDistanceKm: 10_000,
          intervalMonths: undefined,
        }),
      ],
      economyStandard: 'km_l',
    });

    expect(view.upcomingMaintenance.map((s) => s.scheduleId)).toEqual(['late']);
  });

  it('surfaces expired and expiring documents only', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      documents: [
        document({ id: 'good', expiresAt: '2027-01-01T00:00:00.000Z' }),
        document({ id: 'gone', expiresAt: '2025-01-01T00:00:00.000Z' }),
      ],
      economyStandard: 'km_l',
    });

    expect(view.expiringDocuments.map((d) => d.documentId)).toEqual(['gone']);
  });

  it('builds recent activity newest-first with working deep links', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords: [fuelRecord({ id: 'f1', filledAt: '2025-03-01T00:00:00.000Z' })],
      maintenanceRecords: [maintenanceRecord({ id: 'm1', servicedAt: '2025-03-10T00:00:00.000Z' })],
      economyStandard: 'km_l',
    });

    expect(view.recentActivity[0]?.type).toBe('maintenance');
    expect(view.recentActivity[0]?.deepLink).toContain(
      'carbuddy://vehicle/vehicle-1/maintenance/record/m1',
    );
    expect(view.recentActivity[1]?.deepLink).toContain('carbuddy://vehicle/vehicle-1/fuel/f1');
  });

  it('answers ownership questions once there is data to answer them with', () => {
    const view = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords: fuelSeries(
        [
          { distance: 500, litres: 40 },
          { distance: 500, litres: 40 },
          { distance: 500, litres: 40 },
        ],
        { date: '2025-01-01T00:00:00.000Z' },
      ),
      economyStandard: 'km_l',
    });

    const ids = view.insights.map((i) => i.id);
    expect(ids).toContain('cost_per_km');
    expect(ids).toContain('fuel_share');
    expect(view.insights.every((i) => i.question.endsWith('?'))).toBe(true);
  });

  it('is deterministic — the same input always yields the same view', () => {
    const input = {
      now: NOW,
      vehicle: vehicle(),
      fuelRecords: fuelSeries([
        { distance: 500, litres: 40 },
        { distance: 500, litres: 45 },
      ]),
      economyStandard: 'km_l' as const,
    };

    expect(buildDashboard(input)).toEqual(buildDashboard(input));
  });

  it('reports the same economy figure in every standard the user might pick', () => {
    const fuelRecords = fuelSeries([{ distance: 500, litres: 50 }]);

    const metric = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords,
      economyStandard: 'km_l',
    });
    const imperial = buildDashboard({
      now: NOW,
      vehicle: vehicle(),
      fuelRecords,
      economyStandard: 'mpg_us',
    });

    // The underlying measurement is standard-agnostic; only its display differs.
    expect(metric.averageEfficiency).toEqual(imperial.averageEfficiency);
  });
});

describe('computeVehicleHealth', () => {
  const NOW_H = '2025-03-01T00:00:00.000Z';

  it('is provisional rather than perfect for an empty garage', () => {
    const health = computeVehicleHealth({});
    expect(health.provisional).toBe(true);
    expect(health.band).toBe('unknown');
    expect(health.headline).toContain('more information');
  });

  it('scores a well-kept vehicle highly', () => {
    const health = computeVehicleHealth({
      schedules: evaluateSchedules(
        [
          schedule({
            intervalDistanceKm: 10_000,
            lastServiceOdometerKm: 10_000,
            intervalMonths: undefined,
          }),
        ],
        { now: NOW_H, currentOdometerKm: 11_000 },
      ),
      documents: evaluateDocuments([document({ expiresAt: '2027-01-01T00:00:00.000Z' })], NOW_H),
    });

    expect(health.score).toBeGreaterThanOrEqual(90);
    expect(health.band).toBe('excellent');
  });

  it('drops sharply when documents have expired', () => {
    const health = computeVehicleHealth({
      schedules: evaluateSchedules(
        [
          schedule({
            intervalDistanceKm: 10_000,
            lastServiceOdometerKm: 10_000,
            intervalMonths: undefined,
          }),
        ],
        { now: NOW_H, currentOdometerKm: 11_000 },
      ),
      documents: evaluateDocuments([document({ expiresAt: '2024-01-01T00:00:00.000Z' })], NOW_H),
    });

    expect(health.score).toBeLessThan(80);
    expect(health.factors.find((f) => f.id === 'documents')?.issueCount).toBe(1);
  });

  it('explains itself in words for every factor', () => {
    const health = computeVehicleHealth({
      documents: evaluateDocuments([document({ expiresAt: '2024-01-01T00:00:00.000Z' })], NOW_H),
    });

    for (const factor of health.factors) {
      expect(factor.summary.length).toBeGreaterThan(0);
      expect(factor.label.length).toBeGreaterThan(0);
    }
    expect(health.headline.length).toBeGreaterThan(0);
  });

  it('excludes unknown dimensions rather than scoring them as perfect', () => {
    const withOnlyDocs = computeVehicleHealth({
      documents: evaluateDocuments([document({ expiresAt: '2024-01-01T00:00:00.000Z' })], NOW_H),
      schedules: evaluateSchedules(
        [
          schedule({
            intervalDistanceKm: 10_000,
            lastServiceOdometerKm: 10_000,
            intervalMonths: undefined,
          }),
        ],
        { now: NOW_H, currentOdometerKm: 11_000 },
      ),
    });

    // Components and fuel are unknown, so they neither help nor hurt.
    expect(withOnlyDocs.factors.filter((f) => f.band === 'unknown').length).toBe(2);
    expect(withOnlyDocs.score).toBeGreaterThan(0);
  });
});

describe('defaultPreferences', () => {
  it('seeds units from the device region', () => {
    expect(defaultPreferences({ userId: 'u1', regionCode: 'US' }).economyStandard).toBe('mpg_us');
    expect(defaultPreferences({ userId: 'u1', regionCode: 'PH' }).distanceUnit).toBe('km');
  });

  it('defaults to system theme and no biometric lock', () => {
    const prefs = defaultPreferences({ userId: 'u1' });
    expect(prefs.themeMode).toBe('system');
    expect(prefs.biometricLockEnabled).toBe(false);
    expect(prefs.notifications.enabled).toBe(true);
  });
});
