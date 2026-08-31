import { beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateSchedule,
  evaluateSchedules,
  rollForwardSchedule,
} from '../src/maintenance/intervals.js';
import {
  componentCostPerKm,
  evaluateComponent,
  evaluateComponents,
} from '../src/maintenance/components.js';
import { starterSchedules } from '../src/maintenance/defaults.js';
import { component, maintenanceRecord, resetIds, schedule } from './factories.js';

beforeEach(resetIds);

const NOW = '2025-03-01T00:00:00.000Z';

describe('evaluateSchedule — whichever comes first', () => {
  it('fires on the distance bound while the calendar bound is still far off', () => {
    const result = evaluateSchedule(
      schedule({ intervalMonths: 12, intervalDistanceKm: 10_000, lastServiceOdometerKm: 10_000 }),
      { now: NOW, currentOdometerKm: 19_800 },
    );

    expect(result.status).toBe('due_soon');
    expect(result.driver).toBe('distance');
    expect(result.distanceRemainingKm).toBe(200);
    expect(result.reason).toBe('200 km remaining');
  });

  it('fires on the calendar bound while the distance bound is still far off', () => {
    const result = evaluateSchedule(
      schedule({
        intervalMonths: 1,
        intervalDistanceKm: 50_000,
        lastServicedAt: '2025-01-20T00:00:00.000Z',
        lastServiceOdometerKm: 10_000,
      }),
      { now: NOW, currentOdometerKm: 10_500 },
    );

    expect(result.status).toBe('overdue');
    expect(result.driver).toBe('time');
    expect(result.daysRemaining as number).toBeLessThan(0);
  });

  it('reports overdue when the odometer has passed the bound', () => {
    const result = evaluateSchedule(
      schedule({
        intervalDistanceKm: 10_000,
        lastServiceOdometerKm: 10_000,
        intervalMonths: undefined,
      }),
      { now: NOW, currentOdometerKm: 21_000 },
    );

    expect(result.status).toBe('overdue');
    expect(result.reason).toBe('1000 km past due');
    expect(result.progress).toBeGreaterThan(1);
  });

  it('handles month-end arithmetic without rolling into the next month', () => {
    const result = evaluateSchedule(
      schedule({
        intervalMonths: 6,
        intervalDistanceKm: undefined,
        lastServicedAt: '2024-08-31T00:00:00.000Z',
      }),
      { now: '2025-01-01T00:00:00.000Z', currentOdometerKm: 10_000 },
    );

    // Six months after 31 August is 28 February, not 3 March.
    expect(result.dueDate?.slice(0, 10)).toBe('2025-02-28');
  });

  it('projects a distance bound into a date using driving habits', () => {
    const result = evaluateSchedule(
      schedule({
        intervalDistanceKm: 10_000,
        lastServiceOdometerKm: 10_000,
        intervalMonths: undefined,
      }),
      { now: NOW, currentOdometerKm: 18_000, averageDailyDistanceKm: 50 },
    );

    // 2 000 km left at 50 km/day is 40 days out.
    expect(result.projectedDueDate?.slice(0, 10)).toBe('2025-04-10');
    expect(result.effectiveDueDate).toBe(result.projectedDueDate);
  });

  it('picks the earlier of the calendar and projected dates', () => {
    const result = evaluateSchedule(
      schedule({
        intervalMonths: 12,
        intervalDistanceKm: 10_000,
        lastServicedAt: '2025-01-01T00:00:00.000Z',
        lastServiceOdometerKm: 10_000,
      }),
      { now: NOW, currentOdometerKm: 19_000, averageDailyDistanceKm: 50 },
    );

    expect(new Date(result.effectiveDueDate!).getTime()).toBeLessThan(
      new Date(result.dueDate!).getTime(),
    );
  });

  it('is unknown, not overdue, when the service has never been logged', () => {
    const result = evaluateSchedule(
      schedule({ lastServicedAt: undefined, lastServiceOdometerKm: undefined }),
      { now: NOW, currentOdometerKm: 20_000 },
    );

    expect(result.status).toBe('unknown');
    expect(result.reason).toContain('Log this service once');
  });

  it('reports a disabled schedule as unknown rather than due', () => {
    const result = evaluateSchedule(schedule({ enabled: false }), {
      now: NOW,
      currentOdometerKm: 99_000,
    });
    expect(result.status).toBe('unknown');
    expect(result.reason).toBe('Reminder turned off');
  });

  it('respects a custom lead time', () => {
    const base = { now: NOW, currentOdometerKm: 19_000 };
    const tight = evaluateSchedule(
      schedule({ intervalDistanceKm: 10_000, leadTimeKm: 500, intervalMonths: undefined }),
      base,
    );
    const generous = evaluateSchedule(
      schedule({ intervalDistanceKm: 10_000, leadTimeKm: 2_000, intervalMonths: undefined }),
      base,
    );

    expect(tight.status).toBe('ok');
    expect(generous.status).toBe('due_soon');
  });
});

describe('evaluateSchedules', () => {
  it('sorts the most urgent work first', () => {
    const results = evaluateSchedules(
      [
        schedule({
          id: 'ok',
          title: 'Coolant',
          intervalDistanceKm: 80_000,
          intervalMonths: undefined,
        }),
        schedule({
          id: 'overdue',
          title: 'Oil',
          intervalDistanceKm: 1_000,
          intervalMonths: undefined,
        }),
        schedule({
          id: 'soon',
          title: 'Filter',
          intervalDistanceKm: 2_300,
          intervalMonths: undefined,
        }),
      ],
      { now: NOW, currentOdometerKm: 12_000 },
    );

    expect(results.map((r) => r.scheduleId)).toEqual(['overdue', 'soon', 'ok']);
  });
});

describe('rollForwardSchedule', () => {
  it('re-anchors from the most recent matching service', () => {
    const updated = rollForwardSchedule(schedule({ category: 'engine_oil' }), [
      maintenanceRecord({
        category: 'engine_oil',
        servicedAt: '2025-02-01T00:00:00.000Z',
        odometerKm: 21_000,
      }),
      maintenanceRecord({
        category: 'engine_oil',
        servicedAt: '2024-06-01T00:00:00.000Z',
        odometerKm: 15_000,
      }),
    ]);

    expect(updated.lastServicedAt).toBe('2025-02-01T00:00:00.000Z');
    expect(updated.lastServiceOdometerKm).toBe(21_000);
  });

  it('ignores services from a different category', () => {
    const original = schedule({ category: 'engine_oil' });
    expect(rollForwardSchedule(original, [maintenanceRecord({ category: 'brake_pads' })])).toEqual(
      original,
    );
  });
});

describe('component lifecycle', () => {
  it('ages a component out even with low mileage', () => {
    const result = evaluateComponent(
      component({
        kind: 'tyre_set',
        installedAt: '2019-01-01T00:00:00.000Z',
        installedOdometerKm: 5_000,
      }),
      { now: NOW, currentOdometerKm: 12_000 },
    );

    expect(result.status).toBe('overdue');
    expect(result.reason).toBe('Past its expected life');
  });

  it('wears a component out on distance even when it is nearly new', () => {
    const result = evaluateComponent(
      component({
        kind: 'tyre_set',
        installedAt: '2024-12-01T00:00:00.000Z',
        installedOdometerKm: 5_000,
      }),
      { now: NOW, currentOdometerKm: 60_000 },
    );

    expect(result.status).toBe('overdue');
    expect(result.wear).toBeGreaterThanOrEqual(1);
  });

  it('marks a component unknown when nothing is known about its life', () => {
    const result = evaluateComponent(component({ kind: 'custom' }), {
      now: NOW,
      currentOdometerKm: 12_000,
    });
    expect(result.status).toBe('unknown');
    expect(result.usingDefaultLife).toBe(true);
  });

  it('honours user-supplied life over the built-in estimate', () => {
    const result = evaluateComponent(
      component({ kind: 'tyre_set', expectedLifeKm: 100_000, expectedLifeMonths: 240 }),
      { now: NOW, currentOdometerKm: 30_000 },
    );

    expect(result.status).toBe('ok');
    expect(result.usingDefaultLife).toBe(false);
  });

  it('tracks warranty by both date and distance', () => {
    const withinBoth = evaluateComponent(
      component({ warrantyExpiresAt: '2026-01-01T00:00:00.000Z', warrantyDistanceKm: 40_000 }),
      { now: NOW, currentOdometerKm: 20_000 },
    );
    const distanceExceeded = evaluateComponent(
      component({ warrantyExpiresAt: '2026-01-01T00:00:00.000Z', warrantyDistanceKm: 10_000 }),
      { now: NOW, currentOdometerKm: 40_000 },
    );

    expect(withinBoth.warrantyActive).toBe(true);
    expect(distanceExceeded.warrantyActive).toBe(false);
  });

  it('counts down to the next tyre rotation', () => {
    const result = evaluateComponent(
      component({ rotationIntervalKm: 10_000, lastRotatedOdometerKm: 12_000 }),
      { now: NOW, currentOdometerKm: 20_500 },
    );
    expect(result.rotationDueInKm).toBe(1_500);
  });

  it('hides removed components and sorts the rest by wear', () => {
    const results = evaluateComponents(
      [
        component({ id: 'new', kind: 'battery', installedAt: '2025-01-01T00:00:00.000Z' }),
        component({ id: 'old', kind: 'battery', installedAt: '2019-01-01T00:00:00.000Z' }),
        component({ id: 'gone', kind: 'battery', removedAt: '2024-01-01T00:00:00.000Z' }),
      ],
      { now: NOW, currentOdometerKm: 12_000 },
    );

    expect(results.map((r) => r.componentId)).toEqual(['old', 'new']);
  });

  it('computes cost per km only for a replaced component', () => {
    expect(
      componentCostPerKm(
        component({
          purchasePrice: 40_000,
          installedOdometerKm: 10_000,
          removedOdometerKm: 50_000,
        }),
      ),
    ).toBe(1);
    expect(componentCostPerKm(component({ purchasePrice: 40_000 }))).toBeNull();
  });
});

describe('starter schedules', () => {
  it('gives diesel a fuel filter and no spark plugs', () => {
    const diesel = starterSchedules('diesel').map((s) => s.category);
    expect(diesel).toContain('fuel_filter');
    expect(diesel).not.toContain('spark_plugs');
  });

  it('gives electric no oil change', () => {
    const electric = starterSchedules('electric').map((s) => s.category);
    expect(electric).not.toContain('engine_oil');
    expect(electric).toContain('tyre_rotation');
  });

  it('treats hybrids as combustion vehicles for oil purposes', () => {
    expect(starterSchedules('hybrid').map((s) => s.category)).toContain('engine_oil');
  });
});
