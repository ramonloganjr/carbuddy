import { beforeEach, describe, expect, it } from 'vitest';
import { analyseConsumption } from '../src/fuel/consumption.js';
import {
  computeFuelStatistics,
  efficiencyBaseline,
  efficiencySeries,
  efficiencyTrend,
  monthlyFuelSeries,
} from '../src/fuel/statistics.js';
import { efficiencyAs } from '../src/units/units.js';
import { fuelRecord, fuelSeries, resetIds } from './factories.js';

beforeEach(resetIds);

describe('computeFuelStatistics', () => {
  it('returns a safe empty shape for a vehicle with no fill-ups', () => {
    const stats = computeFuelStatistics([], 'EUR');
    expect(stats.recordCount).toBe(0);
    expect(stats.currency).toBe('EUR');
    expect(stats.averagePricePerLitre).toBeNull();
    expect(stats.fuelCostPerKm).toBeNull();
    expect(stats.bestSegment).toBeNull();
  });

  it('counts spend across every record but efficiency only across measured ones', () => {
    const records = [
      // Opening tank: its money counts, its fuel is not attributed to a segment.
      fuelRecord({ id: 'a', odometerKm: 10_000, litres: 45, totalCost: 6_750, isFullTank: true }),
      fuelRecord({ id: 'b', odometerKm: 10_500, litres: 40, totalCost: 6_000, isFullTank: true }),
    ];

    const stats = computeFuelStatistics(records);

    expect(stats.totalLitres).toBe(85);
    expect(stats.totalCost).toBe(12_750);
    expect(stats.measuredDistanceKm).toBe(500);
    expect(stats.averageEfficiency.litres).toBe(40);
  });

  it('weights average pump price by volume rather than averaging the prices', () => {
    const records = [
      fuelRecord({ odometerKm: 10_000, litres: 10, totalCost: 1_000, isFullTank: true }), // 100/L
      fuelRecord({ odometerKm: 10_400, litres: 90, totalCost: 18_000, isFullTank: true }), // 200/L
    ];

    const stats = computeFuelStatistics(records);

    // Volume-weighted is 190/L; the naive mean of the two prices would be 150.
    expect(stats.averagePricePerLitre).toBeCloseTo(190, 6);
    expect(stats.lowestPricePerLitre).toBeCloseTo(100, 6);
    expect(stats.highestPricePerLitre).toBeCloseTo(200, 6);
  });

  it('identifies best and worst segments consistently', () => {
    const records = fuelSeries([
      { distance: 500, litres: 50 }, // 10 km/L
      { distance: 500, litres: 25 }, // 20 km/L — best
      { distance: 500, litres: 62.5 }, // 8 km/L — worst
    ]);

    const stats = computeFuelStatistics(records);

    expect(efficiencyAs(stats.bestSegment!.efficiency, 'km_l')).toBeCloseTo(20, 6);
    expect(efficiencyAs(stats.worstSegment!.efficiency, 'km_l')).toBeCloseTo(8, 6);
  });

  it('reports gaps between fill-ups', () => {
    const stats = computeFuelStatistics(
      fuelSeries([
        { distance: 400, litres: 40, days: 10 },
        { distance: 600, litres: 60, days: 20 },
      ]),
    );

    expect(stats.averageDistanceBetweenFillsKm).toBeCloseTo(500, 6);
    expect(stats.averageDaysBetweenFills).toBeCloseTo(15, 6);
  });
});

describe('monthlyFuelSeries', () => {
  it('buckets spend by receipt date and efficiency by when a segment closed', () => {
    const records = [
      fuelRecord({
        odometerKm: 10_000,
        litres: 45,
        totalCost: 6_000,
        filledAt: '2025-01-20T00:00:00.000Z',
        isFullTank: true,
      }),
      fuelRecord({
        odometerKm: 10_500,
        litres: 40,
        totalCost: 5_000,
        filledAt: '2025-02-05T00:00:00.000Z',
        isFullTank: true,
      }),
    ];

    const series = monthlyFuelSeries(records);

    expect(series.map((p) => p.month)).toEqual(['2025-01', '2025-02']);
    expect(series[0]?.cost).toBe(6_000);
    // January has no closed segment, so no efficiency — not a zero.
    expect(series[0]?.distanceKm).toBe(0);
    expect(series[1]?.distanceKm).toBe(500);
  });

  it('is chronologically ordered', () => {
    const series = monthlyFuelSeries(
      fuelSeries([
        { distance: 400, litres: 40, days: 40 },
        { distance: 400, litres: 40, days: 40 },
      ]),
    );
    expect([...series].sort((a, b) => a.month.localeCompare(b.month))).toEqual(series);
  });
});

describe('efficiencyTrend', () => {
  it('refuses to call a trend without a full window on both sides', () => {
    const { segments } = analyseConsumption(fuelSeries([{ distance: 400, litres: 40 }]));
    const trend = efficiencyTrend(segments, 'km_l', 3);
    expect(trend.direction).toBe('unknown');
    expect(trend.changePercent).toBeNull();
  });

  it('detects a decline and reports it as negative in km/L', () => {
    const { segments } = analyseConsumption(
      fuelSeries([
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 55 },
        { distance: 500, litres: 55 },
        { distance: 500, litres: 55 },
      ]),
    );

    const trend = efficiencyTrend(segments, 'km_l', 3);

    expect(trend.direction).toBe('declining');
    expect(trend.changePercent as number).toBeLessThan(0);
  });

  it('reports the same direction whichever standard the user prefers', () => {
    const { segments } = analyseConsumption(
      fuelSeries([
        { distance: 500, litres: 55 },
        { distance: 500, litres: 55 },
        { distance: 500, litres: 55 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
      ]),
    );

    for (const standard of ['km_l', 'l_100km', 'mpg_us', 'mpg_imp'] as const) {
      expect(efficiencyTrend(segments, standard, 3).direction).toBe('improving');
    }
  });

  it('calls small movements steady rather than a trend', () => {
    const { segments } = analyseConsumption(
      fuelSeries([
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40 },
        { distance: 500, litres: 40.5 },
        { distance: 500, litres: 40.5 },
        { distance: 500, litres: 40.5 },
      ]),
    );
    expect(efficiencyTrend(segments, 'km_l', 3).direction).toBe('steady');
  });
});

describe('efficiencyBaseline and series', () => {
  it('uses the median so one road trip does not move the baseline', () => {
    const { segments } = analyseConsumption(
      fuelSeries([
        { distance: 500, litres: 50 },
        { distance: 500, litres: 50 },
        { distance: 500, litres: 50 },
        { distance: 500, litres: 10 }, // one exceptional highway run
        { distance: 500, litres: 50 },
      ]),
    );

    const baseline = efficiencyBaseline(segments);
    expect(efficiencyAs(baseline, 'km_l')).toBeCloseTo(10, 6);
  });

  it('produces chartable points in the requested standard', () => {
    const { segments } = analyseConsumption(
      fuelSeries([
        { distance: 500, litres: 50 },
        { distance: 500, litres: 25 },
      ]),
    );

    const points = efficiencySeries(segments, 'km_l');
    expect(points).toHaveLength(2);
    expect(points[1]?.value).toBeCloseTo(20, 6);
  });
});
