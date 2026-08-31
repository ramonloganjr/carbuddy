import type { Kilometres, Litres } from '../common/types.js';
import { round } from '../common/types.js';

// ---------------------------------------------------------------------------
// Unit systems
// ---------------------------------------------------------------------------

export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'l' | 'gal_us' | 'gal_imp';
export type PressureUnit = 'psi' | 'bar' | 'kpa';

/**
 * The four fuel-economy conventions the product supports. `l_100km` is
 * "lower is better"; the other three are "higher is better". Every piece of UI
 * that draws a trend arrow must consult {@link higherIsBetter} rather than
 * assuming a direction.
 */
export type FuelEconomyStandard = 'km_l' | 'l_100km' | 'mpg_us' | 'mpg_imp';

export const KM_PER_MILE = 1.609344;
export const LITRES_PER_US_GALLON = 3.785411784;
export const LITRES_PER_IMPERIAL_GALLON = 4.54609;
export const KPA_PER_PSI = 6.894757293168361;
export const KPA_PER_BAR = 100;

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

export function toKilometres(value: number, unit: DistanceUnit): Kilometres {
  return unit === 'km' ? value : value * KM_PER_MILE;
}

export function fromKilometres(km: Kilometres, unit: DistanceUnit): number {
  return unit === 'km' ? km : km / KM_PER_MILE;
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

export function toLitres(value: number, unit: VolumeUnit): Litres {
  switch (unit) {
    case 'l':
      return value;
    case 'gal_us':
      return value * LITRES_PER_US_GALLON;
    case 'gal_imp':
      return value * LITRES_PER_IMPERIAL_GALLON;
  }
}

export function fromLitres(litres: Litres, unit: VolumeUnit): number {
  switch (unit) {
    case 'l':
      return litres;
    case 'gal_us':
      return litres / LITRES_PER_US_GALLON;
    case 'gal_imp':
      return litres / LITRES_PER_IMPERIAL_GALLON;
  }
}

// ---------------------------------------------------------------------------
// Pressure (tyre specifications)
// ---------------------------------------------------------------------------

export function toKilopascals(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'kpa':
      return value;
    case 'psi':
      return value * KPA_PER_PSI;
    case 'bar':
      return value * KPA_PER_BAR;
  }
}

export function fromKilopascals(kpa: number, unit: PressureUnit): number {
  switch (unit) {
    case 'kpa':
      return kpa;
    case 'psi':
      return kpa / KPA_PER_PSI;
    case 'bar':
      return kpa / KPA_PER_BAR;
  }
}

// ---------------------------------------------------------------------------
// Fuel efficiency
// ---------------------------------------------------------------------------

/**
 * Fuel efficiency as the raw pair it was measured from, rather than as a single
 * pre-divided number.
 *
 * This exists to prevent a specific, very common bug: averaging economy figures
 * directly. The mean of 10 km/L and 20 km/L is not 15 km/L unless the two
 * segments covered identical distance — the correct combined figure is
 * total distance / total fuel. Keeping both components lets
 * {@link combineEfficiency} do that correctly, and conversion to any of the
 * four display standards stays exact because it happens once, at the end.
 */
export interface FuelEfficiency {
  readonly kilometres: Kilometres;
  readonly litres: Litres;
}

export function makeEfficiency(kilometres: Kilometres, litres: Litres): FuelEfficiency {
  return { kilometres, litres };
}

export const ZERO_EFFICIENCY: FuelEfficiency = { kilometres: 0, litres: 0 };

/** Sum distance and fuel, then divide once. The only correct way to average. */
export function combineEfficiency(parts: readonly FuelEfficiency[]): FuelEfficiency {
  let kilometres = 0;
  let litres = 0;
  for (const part of parts) {
    kilometres += part.kilometres;
    litres += part.litres;
  }
  return { kilometres, litres };
}

export function isMeasurable(efficiency: FuelEfficiency): boolean {
  return efficiency.kilometres > 0 && efficiency.litres > 0;
}

/**
 * Express an efficiency in the user's chosen standard.
 * Returns `null` when there is not enough data to divide.
 */
export function efficiencyAs(
  efficiency: FuelEfficiency,
  standard: FuelEconomyStandard,
): number | null {
  const { kilometres, litres } = efficiency;
  if (!isMeasurable(efficiency)) return null;

  switch (standard) {
    case 'km_l':
      return kilometres / litres;
    case 'l_100km':
      return (litres / kilometres) * 100;
    case 'mpg_us':
      return kilometres / KM_PER_MILE / (litres / LITRES_PER_US_GALLON);
    case 'mpg_imp':
      return kilometres / KM_PER_MILE / (litres / LITRES_PER_IMPERIAL_GALLON);
  }
}

/**
 * Build an efficiency from a bare figure in some standard. Needed when a user
 * types a manufacturer's rated economy rather than logging real fill-ups; we
 * normalise it against a nominal 100 km so it composes with measured data.
 */
export function efficiencyFrom(value: number, standard: FuelEconomyStandard): FuelEfficiency {
  if (!Number.isFinite(value) || value <= 0) return ZERO_EFFICIENCY;
  switch (standard) {
    case 'km_l':
      return { kilometres: value, litres: 1 };
    case 'l_100km':
      return { kilometres: 100, litres: value };
    case 'mpg_us':
      return { kilometres: value * KM_PER_MILE, litres: LITRES_PER_US_GALLON };
    case 'mpg_imp':
      return { kilometres: value * KM_PER_MILE, litres: LITRES_PER_IMPERIAL_GALLON };
  }
}

/**
 * Whether a larger number means better economy in this standard.
 * `l_100km` is consumption, so it inverts.
 */
export function higherIsBetter(standard: FuelEconomyStandard): boolean {
  return standard !== 'l_100km';
}

/**
 * Signed "goodness" delta between two efficiencies in the given standard:
 * positive always means *improved*, whichever standard is in use. UI trend
 * arrows and screen-reader strings both read from this so that a car getting
 * more efficient never renders as a red down-arrow just because the user
 * happens to prefer L/100 km.
 */
export function efficiencyImprovement(
  from: FuelEfficiency,
  to: FuelEfficiency,
  standard: FuelEconomyStandard,
): number | null {
  const a = efficiencyAs(from, standard);
  const b = efficiencyAs(to, standard);
  if (a === null || b === null || a === 0) return null;
  const delta = ((b - a) / Math.abs(a)) * 100;
  return higherIsBetter(standard) ? delta : -delta;
}

// ---------------------------------------------------------------------------
// Labels & formatting
// ---------------------------------------------------------------------------

export const DISTANCE_UNIT_LABEL: Readonly<Record<DistanceUnit, string>> = {
  km: 'km',
  mi: 'mi',
};

export const VOLUME_UNIT_LABEL: Readonly<Record<VolumeUnit, string>> = {
  l: 'L',
  gal_us: 'gal',
  gal_imp: 'gal',
};

export const FUEL_ECONOMY_LABEL: Readonly<Record<FuelEconomyStandard, string>> = {
  km_l: 'km/L',
  l_100km: 'L/100km',
  mpg_us: 'MPG',
  mpg_imp: 'MPG',
};

/** Unambiguous names for settings screens, where `MPG` alone is not enough. */
export const FUEL_ECONOMY_LONG_LABEL: Readonly<Record<FuelEconomyStandard, string>> = {
  km_l: 'Kilometres per litre (km/L)',
  l_100km: 'Litres per 100 kilometres (L/100km)',
  mpg_us: 'Miles per gallon — US (MPG)',
  mpg_imp: 'Miles per gallon — Imperial (MPG)',
};

/** Decimal places that read naturally for each standard. */
export const FUEL_ECONOMY_PRECISION: Readonly<Record<FuelEconomyStandard, number>> = {
  km_l: 1,
  l_100km: 1,
  mpg_us: 1,
  mpg_imp: 1,
};

export interface NumberFormatOptions {
  locale?: string;
  decimals?: number;
}

export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { locale, decimals = 0 } = options;
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
}

export function formatDistance(
  km: Kilometres,
  unit: DistanceUnit,
  options: NumberFormatOptions = {},
): string {
  const value = fromKilometres(km, unit);
  return `${formatNumber(value, { decimals: 0, ...options })} ${DISTANCE_UNIT_LABEL[unit]}`;
}

export function formatVolume(
  litres: Litres,
  unit: VolumeUnit,
  options: NumberFormatOptions = {},
): string {
  const value = fromLitres(litres, unit);
  return `${formatNumber(value, { decimals: 2, ...options })} ${VOLUME_UNIT_LABEL[unit]}`;
}

export function formatEfficiency(
  efficiency: FuelEfficiency,
  standard: FuelEconomyStandard,
  options: NumberFormatOptions & { placeholder?: string } = {},
): string {
  const { placeholder = '—' } = options;
  const value = efficiencyAs(efficiency, standard);
  if (value === null) return placeholder;
  const decimals = options.decimals ?? FUEL_ECONOMY_PRECISION[standard];
  return `${formatNumber(round(value, decimals), { ...options, decimals })} ${FUEL_ECONOMY_LABEL[standard]}`;
}

/**
 * Sensible unit defaults for a region, used to pre-fill onboarding so most
 * users never have to open the units screen at all.
 */
export interface UnitPreset {
  distance: DistanceUnit;
  volume: VolumeUnit;
  economy: FuelEconomyStandard;
  pressure: PressureUnit;
}

export const UNIT_PRESETS = {
  metric: { distance: 'km', volume: 'l', economy: 'km_l', pressure: 'kpa' },
  metricEurope: { distance: 'km', volume: 'l', economy: 'l_100km', pressure: 'bar' },
  us: { distance: 'mi', volume: 'gal_us', economy: 'mpg_us', pressure: 'psi' },
  uk: { distance: 'mi', volume: 'gal_imp', economy: 'mpg_imp', pressure: 'psi' },
} as const satisfies Record<string, UnitPreset>;

export type UnitPresetName = keyof typeof UNIT_PRESETS;

/** Region -> preset. Falls back to metric, which is what most of the world uses. */
export function presetForRegion(regionCode: string | undefined): UnitPreset {
  const region = (regionCode ?? '').toUpperCase();
  if (region === 'US' || region === 'LR' || region === 'MM') return UNIT_PRESETS.us;
  if (region === 'GB' || region === 'IM' || region === 'JE' || region === 'GG')
    return UNIT_PRESETS.uk;
  const litresPer100Region = [
    'DE',
    'FR',
    'IT',
    'ES',
    'NL',
    'BE',
    'AT',
    'CH',
    'SE',
    'NO',
    'DK',
    'FI',
    'PL',
    'PT',
    'CZ',
  ];
  if (litresPer100Region.includes(region)) return UNIT_PRESETS.metricEurope;
  return UNIT_PRESETS.metric;
}
