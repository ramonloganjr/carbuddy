import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyseConsumption,
  averageDailyDistance,
  loggedDistance,
  pricePerLitre,
  sortFuelRecords,
} from '../src/fuel/consumption.js';
import { efficiencyAs } from '../src/units/units.js';
import { fuelRecord, resetIds } from './factories.js';

beforeEach(resetIds);

describe('sortFuelRecords', () => {
  it('orders by odometer, because users back-date receipts', () => {
    const later = fuelRecord({ odometerKm: 10_500, filledAt: '2025-01-01T00:00:00.000Z' });
    const earlier = fuelRecord({ odometerKm: 10_000, filledAt: '2025-02-01T00:00:00.000Z' });
    const sorted = sortFuelRecords([later, earlier]);
    expect(sorted.map((r) => r.odometerKm)).toEqual([10_000, 10_500]);
  });

  it('breaks odometer ties by timestamp', () => {
    const second = fuelRecord({ odometerKm: 10_000, filledAt: '2025-01-02T00:00:00.000Z' });
    const first = fuelRecord({ odometerKm: 10_000, filledAt: '2025-01-01T00:00:00.000Z' });
    expect(sortFuelRecords([second, first])[0]?.filledAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('does not mutate its input', () => {
    const records = [fuelRecord({ odometerKm: 20_000 }), fuelRecord({ odometerKm: 10_000 })];
    const snapshot = [...records];
    sortFuelRecords(records);
    expect(records).toEqual(snapshot);
  });
});

describe('analyseConsumption — full-to-full method', () => {
  it('excludes the opening tank from the segment it starts', () => {
    // Fill to full at 10 000 km with 45 L, drive 500 km, fill 40 L to full.
    // The 40 L is what the 500 km consumed. The opening 45 L is not.
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, isFullTank: true }),
    ];

    const { segments } = analyseConsumption(records);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.litres).toBe(40);
    expect(segments[0]?.distanceKm).toBe(500);
    expect(efficiencyAs(segments[0]!.efficiency, 'km_l')).toBeCloseTo(12.5, 6);
  });

  it('needs two full tanks before it can measure anything', () => {
    const { segments, unmeasured } = analyseConsumption([
      fuelRecord({ id: 'a', odometerKm: 10_000, isFullTank: true }),
    ]);
    expect(segments).toHaveLength(0);
    expect(unmeasured).toHaveLength(0);
  });

  it('rolls partial fills into the next full-tank segment', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_200, litres: 15, isFullTank: false }),
      fuelRecord({ id: 'c', odometerKm: 10_400, litres: 10, isFullTank: false }),
      fuelRecord({ id: 'd', odometerKm: 10_600, litres: 20, isFullTank: true }),
    ];

    const { segments } = analyseConsumption(records);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.litres).toBe(45); // 15 + 10 + 20
    expect(segments[0]?.distanceKm).toBe(600);
    expect(segments[0]?.fillCount).toBe(3);
  });

  it('cannot measure fills before the first full tank', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 20, isFullTank: false }),
      fuelRecord({ id: 'b', odometerKm: 10_200, litres: 25, isFullTank: false }),
      fuelRecord({ id: 'c', odometerKm: 10_400, litres: 40, isFullTank: true }),
      fuelRecord({ id: 'd', odometerKm: 10_800, litres: 30, isFullTank: true }),
    ];

    const { segments, unmeasured } = analyseConsumption(records);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.fromRecordId).toBe('c');
    expect(
      unmeasured.filter((u) => u.reason === 'before_first_full_tank').map((u) => u.recordId),
    ).toEqual(['a', 'b']);
  });

  it('breaks the chain at a user-flagged missed fill', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, isFullTank: true }),
      fuelRecord({ id: 'c', odometerKm: 11_500, litres: 42, isFullTank: true, missedFill: true }),
      fuelRecord({ id: 'd', odometerKm: 12_000, litres: 38, isFullTank: true }),
    ];

    const { segments } = analyseConsumption(records);

    // a->b is fine; the missed fill invalidates b->c; c->d re-anchors cleanly.
    expect(segments.map((s) => [s.fromRecordId, s.toRecordId])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('does not divide by zero when two full tanks share an odometer reading', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({
        id: 'b',
        odometerKm: 10_000,
        litres: 5,
        isFullTank: true,
        filledAt: '2025-01-01T09:00:00.000Z',
      }),
      fuelRecord({
        id: 'c',
        odometerKm: 10_500,
        litres: 40,
        isFullTank: true,
        filledAt: '2025-01-08T09:00:00.000Z',
      }),
    ];

    const { segments, unmeasured } = analyseConsumption(records);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.fromRecordId).toBe('b');
    expect(
      segments.every((s) => Number.isFinite(efficiencyAs(s.efficiency, 'km_l') as number)),
    ).toBe(true);
    expect(unmeasured.some((u) => u.reason === 'no_distance')).toBe(true);
  });

  it('reports a trailing partial fill as pending, not as a gap', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, isFullTank: true }),
      fuelRecord({ id: 'c', odometerKm: 10_700, litres: 15, isFullTank: false }),
    ];

    const { segments, unmeasured } = analyseConsumption(records);

    expect(segments).toHaveLength(1);
    expect(unmeasured).toEqual([{ recordId: 'c', reason: 'pending_next_full_tank' }]);
  });

  it('produces chained segments that share boundaries', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, isFullTank: true }),
      fuelRecord({ id: 'c', odometerKm: 11_000, litres: 38, isFullTank: true }),
    ];

    const { segments } = analyseConsumption(records);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.endOdometerKm).toBe(segments[1]?.startOdometerKm);
    expect(segments[0]?.toRecordId).toBe(segments[1]?.fromRecordId);
  });

  it('sums only the cost of the fuel it counts', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, totalCost: 9_999, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_300, litres: 20, totalCost: 3_000, isFullTank: false }),
      fuelRecord({ id: 'c', odometerKm: 10_600, litres: 20, totalCost: 3_100, isFullTank: true }),
    ];

    const { segments } = analyseConsumption(records);

    expect(segments[0]?.cost).toBe(6_100); // opening tank's 9 999 excluded
  });

  it('is deterministic regardless of input order', () => {
    const records = [
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, isFullTank: true }),
      fuelRecord({ id: 'c', odometerKm: 11_000, litres: 38, isFullTank: true }),
    ];

    const forward = analyseConsumption(records);
    const shuffled = analyseConsumption([records[2]!, records[0]!, records[1]!]);

    expect(shuffled.segments).toEqual(forward.segments);
  });
});

describe('derived distance figures', () => {
  it('measures logged distance from first to last reading', () => {
    expect(
      loggedDistance([fuelRecord({ odometerKm: 10_000 }), fuelRecord({ odometerKm: 12_500 })]),
    ).toBe(2_500);
  });

  it('needs two records for a daily average', () => {
    expect(averageDailyDistance([fuelRecord({})])).toBeNull();
  });

  it('computes average daily distance across the log', () => {
    const daily = averageDailyDistance([
      fuelRecord({ odometerKm: 10_000, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuelRecord({ odometerKm: 11_000, filledAt: '2025-01-11T00:00:00.000Z' }),
    ]);
    expect(daily).toBeCloseTo(100, 6);
  });

  it('refuses to extrapolate a daily rate from a few hours of driving', () => {
    // 150 km in three hours is a real drive, but 1,200 km/day is not a habit —
    // and projecting service dates from it would be badly wrong.
    expect(
      averageDailyDistance([
        fuelRecord({ odometerKm: 10_000, filledAt: '2025-01-01T06:00:00.000Z' }),
        fuelRecord({ odometerKm: 10_150, filledAt: '2025-01-01T09:00:00.000Z' }),
      ]),
    ).toBeNull();
  });

  it('uses fractional days so a 9.5-day log is not rounded to 10', () => {
    const daily = averageDailyDistance([
      fuelRecord({ odometerKm: 10_000, filledAt: '2025-01-01T00:00:00.000Z' }),
      fuelRecord({ odometerKm: 10_950, filledAt: '2025-01-10T12:00:00.000Z' }),
    ]);
    expect(daily).toBeCloseTo(100, 6);
  });

  it('computes unit price and guards against zero volume', () => {
    expect(pricePerLitre(fuelRecord({ litres: 40, totalCost: 6_000 }))).toBe(150);
    expect(pricePerLitre(fuelRecord({ litres: 0 }))).toBeNull();
  });
});
