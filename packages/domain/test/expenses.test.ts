import { beforeEach, describe, expect, it } from 'vitest';
import { projectExpenses } from '../src/expenses/projection.js';
import {
  costPerDistance,
  expensesInRange,
  monthOverMonthChange,
  summariseExpenses,
} from '../src/expenses/summary.js';
import {
  allocateMoney,
  formatMoney,
  fromMinorUnits,
  percentageOf,
  toMinorUnits,
} from '../src/common/money.js';
import { expense, fuelRecord, maintenanceRecord, resetIds } from './factories.js';

beforeEach(resetIds);

describe('projectExpenses', () => {
  it('folds fuel and maintenance into one stream', () => {
    const expenses = projectExpenses({
      fuelRecords: [fuelRecord({ id: 'f1', totalCost: 6_000 })],
      maintenanceRecords: [maintenanceRecord({ id: 'm1', totalCost: 7_700 })],
      manualExpenses: [expense({ id: 'e1', amount: 500 })],
    });

    expect(expenses).toHaveLength(3);
    expect(expenses.reduce((acc, e) => acc + e.amount, 0)).toBe(14_200);
  });

  /**
   * The double-count guard: a user who logs a fill-up and *also* files the
   * receipt as an expense must see one cost, not two.
   */
  it('drops a manual expense that duplicates a projected record', () => {
    const expenses = projectExpenses({
      fuelRecords: [fuelRecord({ id: 'f1', totalCost: 6_000 })],
      manualExpenses: [
        expense({
          id: 'dupe',
          amount: 6_000,
          category: 'fuel',
          source: 'fuel_record',
          sourceId: 'f1',
        }),
      ],
    });

    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amount).toBe(6_000);
  });

  it('keeps a manual expense whose source record no longer exists', () => {
    const expenses = projectExpenses({
      fuelRecords: [],
      manualExpenses: [expense({ id: 'orphan', source: 'fuel_record', sourceId: 'deleted' })],
    });
    expect(expenses).toHaveLength(1);
  });

  it('separates repairs from scheduled maintenance', () => {
    const expenses = projectExpenses({
      maintenanceRecords: [
        maintenanceRecord({ id: 'm1', category: 'engine_oil' }),
        maintenanceRecord({ id: 'm2', category: 'repair' }),
        maintenanceRecord({ id: 'm3', category: 'tyres' }),
        maintenanceRecord({ id: 'm4', category: 'inspection' }),
      ],
    });

    expect(expenses.map((e) => e.category).sort()).toEqual([
      'inspection',
      'maintenance',
      'repair',
      'tyres',
    ]);
  });

  it('returns a chronologically sorted stream', () => {
    const expenses = projectExpenses({
      fuelRecords: [fuelRecord({ filledAt: '2025-03-01T00:00:00.000Z' })],
      manualExpenses: [expense({ incurredAt: '2025-01-01T00:00:00.000Z' })],
    });

    expect(expenses[0]?.incurredAt).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('summariseExpenses', () => {
  it('handles an empty log without dividing by zero', () => {
    const summary = summariseExpenses([], 'JPY');
    expect(summary.total).toBe(0);
    expect(summary.averagePerMonth).toBe(0);
    expect(summary.monthsCovered).toBe(1);
    expect(summary.currency).toBe('JPY');
  });

  it('breaks spend down by category with shares that add up', () => {
    const summary = summariseExpenses([
      expense({ category: 'fuel', amount: 6_000 }),
      expense({ category: 'maintenance', amount: 3_000 }),
      expense({ category: 'parking', amount: 1_000 }),
    ]);

    expect(summary.total).toBe(10_000);
    expect(summary.byCategory[0]?.category).toBe('fuel');
    expect(summary.fuelSharePercent).toBe(60);
    expect(summary.byCategory.reduce((acc, c) => acc + c.share, 0)).toBeCloseTo(100, 1);
  });

  /**
   * Averaging over months that *contain* receipts rather than months the log
   * spans would flatter the user: a quiet February is a cheap month, not a
   * month that did not happen.
   */
  it('averages over the span, counting empty months as real', () => {
    const summary = summariseExpenses([
      expense({ amount: 12_000, incurredAt: '2025-01-01T00:00:00.000Z' }),
      expense({ amount: 12_000, incurredAt: '2025-07-01T00:00:00.000Z' }),
    ]);

    expect(summary.monthsCovered).toBe(6);
    expect(summary.averagePerMonth).toBe(4_000);
  });

  it('identifies the most and least expensive months', () => {
    const summary = summariseExpenses([
      expense({ amount: 1_000, incurredAt: '2025-01-05T00:00:00.000Z' }),
      expense({ amount: 9_000, incurredAt: '2025-02-05T00:00:00.000Z' }),
      expense({ amount: 3_000, incurredAt: '2025-03-05T00:00:00.000Z' }),
    ]);

    expect(summary.highestMonth?.period).toBe('2025-02');
    expect(summary.lowestMonth?.period).toBe('2025-01');
  });

  it('groups by year as well as by month', () => {
    const summary = summariseExpenses([
      expense({ amount: 1_000, incurredAt: '2024-06-01T00:00:00.000Z' }),
      expense({ amount: 2_000, incurredAt: '2025-06-01T00:00:00.000Z' }),
    ]);

    expect(summary.byYear.map((y) => y.period)).toEqual(['2024', '2025']);
    expect(summary.byYear[1]?.total).toBe(2_000);
  });

  it('counts repairs toward the maintenance share', () => {
    const summary = summariseExpenses([
      expense({ category: 'maintenance', amount: 5_000 }),
      expense({ category: 'repair', amount: 5_000 }),
      expense({ category: 'fuel', amount: 10_000 }),
    ]);
    expect(summary.maintenanceSharePercent).toBe(50);
  });
});

describe('range filtering and trends', () => {
  it('filters a half-open range', () => {
    const items = [
      expense({ id: 'before', incurredAt: '2024-12-31T23:59:59.000Z' }),
      expense({ id: 'inside', incurredAt: '2025-01-15T00:00:00.000Z' }),
      expense({ id: 'boundary', incurredAt: '2025-02-01T00:00:00.000Z' }),
    ];

    const result = expensesInRange(items, '2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z');
    expect(result.map((e) => e.id)).toEqual(['inside']);
  });

  it('reports month-over-month change', () => {
    const summary = summariseExpenses([
      expense({ amount: 10_000, incurredAt: '2025-01-05T00:00:00.000Z' }),
      expense({ amount: 15_000, incurredAt: '2025-02-05T00:00:00.000Z' }),
    ]);
    expect(monthOverMonthChange(summary.byMonth)).toBe(50);
  });

  it('has no month-over-month change with a single month', () => {
    const summary = summariseExpenses([expense({ amount: 10_000 })]);
    expect(monthOverMonthChange(summary.byMonth)).toBeNull();
  });
});

describe('costPerDistance', () => {
  it('computes cost per kilometre', () => {
    const result = costPerDistance([expense({ amount: 100_000 })], 10_000);
    expect(result.costPerKm).toBe(10);
  });

  /** "$0.00/km" reads as "free to run" — the opposite of "we don't know yet". */
  it('returns null rather than zero when distance is unknown', () => {
    expect(costPerDistance([expense({ amount: 100_000 })], 0).costPerKm).toBeNull();
  });
});

describe('money arithmetic', () => {
  it('round-trips through minor units', () => {
    expect(toMinorUnits(12.34, 'USD')).toBe(1_234);
    expect(fromMinorUnits(1_234, 'USD')).toBe(12.34);
  });

  it('respects currencies that are not two-decimal', () => {
    expect(toMinorUnits(1_234, 'JPY')).toBe(1_234);
    expect(toMinorUnits(12.345, 'KWD')).toBe(12_345);
  });

  it('allocates without losing a minor unit', () => {
    const parts = allocateMoney(1_000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000);
  });

  it('treats a zero whole as zero percent rather than NaN', () => {
    expect(percentageOf(500, 0)).toBe(0);
  });

  it('falls back gracefully for an unknown currency code', () => {
    expect(formatMoney(1_234, { currency: 'XYZ', locale: 'en-US' })).toContain('12.34');
  });
});
