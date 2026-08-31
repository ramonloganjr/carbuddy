import { beforeEach, describe, expect, it } from 'vitest';
import { analyseConsumption } from '../src/fuel/consumption.js';
import { detectEfficiencyAnomaly, EFFICIENCY_FACTOR_COPY } from '../src/fuel/anomaly.js';
import { fuelSeries, resetIds } from './factories.js';

beforeEach(resetIds);

const segmentsFor = (entries: readonly { distance: number; litres: number }[]) =>
  analyseConsumption(fuelSeries(entries)).segments;

/** `count` fill-ups all returning the same economy. */
const steady = (count: number, litres = 50) =>
  Array.from({ length: count }, () => ({ distance: 500, litres }));

describe('detectEfficiencyAnomaly', () => {
  it('says nothing until there is enough history to know what normal is', () => {
    const result = detectEfficiencyAnomaly(segmentsFor(steady(3)));
    expect(result.severity).toBe('none');
    expect(result.note).toBe('insufficient_history');
    expect(result.factors).toEqual([]);
  });

  it('stays quiet while consumption is normal', () => {
    const result = detectEfficiencyAnomaly(segmentsFor(steady(10)));
    expect(result.severity).toBe('none');
    expect(result.note).toBe('within_normal_range');
  });

  it('flags a sustained drop in economy', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50), // 10 km/L baseline
        { distance: 500, litres: 70 }, // ~7.1 km/L
        { distance: 500, litres: 70 },
        { distance: 500, litres: 70 },
      ]),
    );

    expect(result.direction).toBe('worse');
    expect(['notable', 'significant']).toContain(result.severity);
    expect(result.deviationPercent).toBeLessThan(-20);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it('recognises an improvement without inventing an explanation for it', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 500, litres: 33 },
        { distance: 500, litres: 33 },
        { distance: 500, litres: 33 },
      ]),
    );

    expect(result.direction).toBe('better');
    expect(result.deviationPercent).toBeGreaterThan(0);
    expect(result.factors).toEqual([]);
  });

  /**
   * The false-positive guard. A car whose economy naturally swings between
   * summer and winter must not be flagged every season, or the user learns to
   * ignore the alert entirely.
   */
  it('tolerates a wide swing on a vehicle whose history is already noisy', () => {
    const noisy = [
      { distance: 500, litres: 40 },
      { distance: 500, litres: 62 },
      { distance: 500, litres: 43 },
      { distance: 500, litres: 60 },
      { distance: 500, litres: 41 },
      { distance: 500, litres: 63 },
      { distance: 500, litres: 45 },
      { distance: 500, litres: 58 },
      { distance: 500, litres: 57 },
      { distance: 500, litres: 58 },
    ];

    const result = detectEfficiencyAnomaly(segmentsFor(noisy));
    expect(result.severity).toBe('none');
  });

  it('flags a smaller move on a vehicle that has always been consistent', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        { distance: 500, litres: 50.0 },
        { distance: 500, litres: 50.1 },
        { distance: 500, litres: 49.9 },
        { distance: 500, litres: 50.0 },
        { distance: 500, litres: 50.1 },
        { distance: 500, litres: 49.9 },
        { distance: 500, litres: 58.0 },
        { distance: 500, litres: 58.0 },
        { distance: 500, litres: 58.0 },
      ]),
    );

    expect(result.severity).not.toBe('none');
    expect(result.direction).toBe('worse');
  });

  it('scales severity with the size of the change', () => {
    const mild = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 500, litres: 58 },
        { distance: 500, litres: 58 },
        { distance: 500, litres: 58 },
      ]),
    );
    const severe = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 500, litres: 90 },
        { distance: 500, litres: 90 },
        { distance: 500, litres: 90 },
      ]),
    );

    expect(Math.abs(severe.deviationPercent)).toBeGreaterThan(Math.abs(mild.deviationPercent));
    expect(severe.severity).toBe('significant');
  });

  it('suggests seasonal weather in winter and A/C otherwise', () => {
    const worse = [
      ...steady(8, 50),
      { distance: 500, litres: 70 },
      { distance: 500, litres: 70 },
      { distance: 500, litres: 70 },
    ];

    const january = detectEfficiencyAnomaly(segmentsFor(worse), { recentMonth: 0 });
    const july = detectEfficiencyAnomaly(segmentsFor(worse), { recentMonth: 6 });

    expect(january.factors).toContain('seasonal_weather');
    expect(july.factors).toContain('air_conditioning');
  });

  it('leads with measurement accuracy when the recent segments are very short', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 80, litres: 12 },
        { distance: 80, litres: 12 },
        { distance: 80, litres: 12 },
      ]),
    );

    expect(result.factors).toContain('measurement_accuracy');
    expect(result.factors).toContain('short_trips');
  });

  it('caps the suggestions so the sheet stays readable', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 500, litres: 80 },
        { distance: 500, litres: 80 },
        { distance: 500, litres: 80 },
      ]),
    );
    expect(result.factors.length).toBeLessThanOrEqual(5);
  });

  it('has user-facing copy for every factor it can emit', () => {
    const result = detectEfficiencyAnomaly(
      segmentsFor([
        ...steady(8, 50),
        { distance: 500, litres: 80 },
        { distance: 500, litres: 80 },
        { distance: 500, litres: 80 },
      ]),
    );
    for (const factor of result.factors) {
      expect(EFFICIENCY_FACTOR_COPY[factor]?.title).toBeTruthy();
      expect(EFFICIENCY_FACTOR_COPY[factor]?.body).toBeTruthy();
    }
  });
});
