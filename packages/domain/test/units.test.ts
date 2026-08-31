import { describe, expect, it } from 'vitest';
import {
  combineEfficiency,
  efficiencyAs,
  efficiencyFrom,
  efficiencyImprovement,
  formatEfficiency,
  fromKilometres,
  fromLitres,
  higherIsBetter,
  makeEfficiency,
  presetForRegion,
  toKilometres,
  toKilopascals,
  toLitres,
} from '../src/units/units.js';
import { round } from '../src/common/types.js';

describe('distance and volume conversion', () => {
  it('round-trips miles through kilometres', () => {
    expect(round(fromKilometres(toKilometres(100, 'mi'), 'mi'), 6)).toBe(100);
  });

  it('uses the exact international mile', () => {
    expect(toKilometres(1, 'mi')).toBe(1.609344);
  });

  it('distinguishes US and Imperial gallons', () => {
    expect(toLitres(1, 'gal_us')).toBeCloseTo(3.785411784, 9);
    expect(toLitres(1, 'gal_imp')).toBeCloseTo(4.54609, 9);
    // A 20% difference — mixing these up is a real reporting bug, not a rounding one.
    expect(toLitres(1, 'gal_imp')).toBeGreaterThan(toLitres(1, 'gal_us') * 1.19);
  });

  it('round-trips litres', () => {
    expect(round(fromLitres(toLitres(15, 'gal_us'), 'gal_us'), 6)).toBe(15);
  });

  it('converts tyre pressure', () => {
    expect(toKilopascals(32, 'psi')).toBeCloseTo(220.63, 2);
    expect(toKilopascals(2.2, 'bar')).toBeCloseTo(220, 6);
  });
});

describe('fuel efficiency conversions', () => {
  const tenKmPerLitre = makeEfficiency(100, 10);

  it('expresses one measurement in every supported standard', () => {
    expect(efficiencyAs(tenKmPerLitre, 'km_l')).toBeCloseTo(10, 6);
    expect(efficiencyAs(tenKmPerLitre, 'l_100km')).toBeCloseTo(10, 6);
    expect(efficiencyAs(tenKmPerLitre, 'mpg_us')).toBeCloseTo(23.5215, 3);
    expect(efficiencyAs(tenKmPerLitre, 'mpg_imp')).toBeCloseTo(28.2481, 3);
  });

  it('returns null rather than Infinity when there is no fuel logged', () => {
    expect(efficiencyAs(makeEfficiency(100, 0), 'km_l')).toBeNull();
    expect(efficiencyAs(makeEfficiency(0, 10), 'mpg_us')).toBeNull();
  });

  it('round-trips through efficiencyFrom in each standard', () => {
    for (const standard of ['km_l', 'l_100km', 'mpg_us', 'mpg_imp'] as const) {
      const rebuilt = efficiencyFrom(25, standard);
      expect(efficiencyAs(rebuilt, standard)).toBeCloseTo(25, 6);
    }
  });

  it('knows which direction is better in each standard', () => {
    expect(higherIsBetter('km_l')).toBe(true);
    expect(higherIsBetter('mpg_us')).toBe(true);
    expect(higherIsBetter('l_100km')).toBe(false);
  });
});

describe('combineEfficiency', () => {
  /**
   * The bug this guards against: averaging the two economy figures directly
   * gives 15 km/L, which is wrong whenever the segments differ in length.
   */
  it('weights by distance rather than averaging the rates', () => {
    const slow = makeEfficiency(100, 10); // 10 km/L over 100 km
    const fast = makeEfficiency(300, 15); // 20 km/L over 300 km
    const combined = combineEfficiency([slow, fast]);

    expect(combined.kilometres).toBe(400);
    expect(combined.litres).toBe(25);
    expect(efficiencyAs(combined, 'km_l')).toBeCloseTo(16, 6);
    expect(efficiencyAs(combined, 'km_l')).not.toBeCloseTo(15, 1);
  });

  it('is empty-safe', () => {
    expect(combineEfficiency([])).toEqual({ kilometres: 0, litres: 0 });
  });
});

describe('efficiencyImprovement', () => {
  const worse = makeEfficiency(100, 12); // 8.33 km/L
  const better = makeEfficiency(100, 10); // 10 km/L

  it('reports improvement as positive in every standard', () => {
    for (const standard of ['km_l', 'l_100km', 'mpg_us', 'mpg_imp'] as const) {
      const delta = efficiencyImprovement(worse, better, standard);
      expect(delta).not.toBeNull();
      expect(delta as number).toBeGreaterThan(0);
    }
  });

  it('reports regression as negative even in L/100km where the number rises', () => {
    expect(efficiencyImprovement(better, worse, 'l_100km') as number).toBeLessThan(0);
    expect(efficiencyImprovement(better, worse, 'mpg_us') as number).toBeLessThan(0);
  });
});

describe('formatting and presets', () => {
  it('formats with the right unit label', () => {
    expect(formatEfficiency(makeEfficiency(100, 10), 'km_l', { locale: 'en-US' })).toBe(
      '10.0 km/L',
    );
    expect(formatEfficiency(makeEfficiency(100, 10), 'l_100km', { locale: 'en-US' })).toBe(
      '10.0 L/100km',
    );
  });

  it('shows a placeholder instead of a broken figure when unmeasurable', () => {
    expect(formatEfficiency(makeEfficiency(0, 0), 'km_l')).toBe('—');
  });

  it('picks region-appropriate defaults', () => {
    expect(presetForRegion('US').economy).toBe('mpg_us');
    expect(presetForRegion('GB').economy).toBe('mpg_imp');
    expect(presetForRegion('DE').economy).toBe('l_100km');
    expect(presetForRegion('PH').economy).toBe('km_l');
    expect(presetForRegion(undefined).distance).toBe('km');
  });
});
