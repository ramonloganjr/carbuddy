import { useMemo } from 'react';
import {
  FUEL_ECONOMY_LABEL,
  efficiencyAs,
  formatDistance,
  formatMoney,
  formatNumber,
  formatVolume,
  fromKilometres,
  fromLitres,
  round,
  type FuelEfficiency,
  type Money,
  type UserPreferences,
} from '@carbuddy/domain';
import { usePreferences } from './preferencesStore';

export interface Formatters {
  /** Money in the user's currency, e.g. `$68.40`. */
  money: (minor: Money) => string;
  /** Compact money for chart axes and dense tiles, e.g. `$68`. */
  moneyCompact: (minor: Money) => string;
  /** Distance in the user's unit, e.g. `12,430 km` or `7,724 mi`. */
  distance: (km: number) => string;
  /** Bare distance number with no unit, for tiles that label separately. */
  distanceValue: (km: number) => string;
  distanceUnit: string;
  /** Volume in litres or gallons. */
  volume: (litres: number) => string;
  volumeUnit: string;
  /** Fuel economy in the chosen standard, e.g. `12.5 km/L`. */
  economy: (efficiency: FuelEfficiency) => string;
  economyValue: (efficiency: FuelEfficiency) => string;
  economyUnit: string;
  /** Cost per distance, e.g. `$0.14/km`. */
  costPerDistance: (costPerKm: Money | null) => string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  /** Relative day phrasing: "Today", "Yesterday", "3 days ago". */
  relativeDate: (iso: string) => string;
  preferences: UserPreferences | null;
}

const PLACEHOLDER = '—';

/**
 * Every user-visible number goes through here.
 *
 * Centralising formatting is what makes the units setting actually work: a
 * single toggle changes every distance, volume and economy figure in the app at
 * once, because no screen formats anything itself. It is also where the
 * "unknown" placeholder is decided, so a missing value never renders as a
 * confident `0`.
 */
export function useFormatters(): Formatters {
  const preferences = usePreferences((state) => state.preferences);

  return useMemo<Formatters>(() => {
    const currency = preferences?.currency ?? 'USD';
    const locale = preferences?.locale;
    const distanceUnit = preferences?.distanceUnit ?? 'km';
    const volumeUnit = preferences?.volumeUnit ?? 'l';
    const economyStandard = preferences?.economyStandard ?? 'km_l';

    return {
      preferences,
      distanceUnit,
      volumeUnit: volumeUnit === 'l' ? 'L' : 'gal',
      economyUnit: FUEL_ECONOMY_LABEL[economyStandard],

      money: (minor) => formatMoney(minor, { currency, locale }),
      moneyCompact: (minor) => formatMoney(minor, { currency, locale, compact: true }),

      distance: (km) => formatDistance(km, distanceUnit, { locale }),
      distanceValue: (km) =>
        formatNumber(Math.round(fromKilometres(km, distanceUnit)), { locale, decimals: 0 }),

      volume: (litres) => formatVolume(litres, volumeUnit, { locale }),

      economy: (efficiency) => {
        const value = efficiencyAs(efficiency, economyStandard);
        if (value === null) return PLACEHOLDER;
        return `${formatNumber(round(value, 1), { locale, decimals: 1 })} ${FUEL_ECONOMY_LABEL[economyStandard]}`;
      },
      economyValue: (efficiency) => {
        const value = efficiencyAs(efficiency, economyStandard);
        if (value === null) return PLACEHOLDER;
        return formatNumber(round(value, 1), { locale, decimals: 1 });
      },

      costPerDistance: (costPerKm) => {
        if (costPerKm === null) return PLACEHOLDER;
        // Convert per-km to per-mile before formatting, or the number is wrong
        // by 60% for anyone using imperial units.
        const perUnit = distanceUnit === 'km' ? costPerKm : costPerKm * 1.609344;
        return `${formatMoney(Math.round(perUnit), { currency, locale })}/${distanceUnit}`;
      },

      date: (iso) => formatDateWith(iso, locale, { dateStyle: 'medium' }),
      dateTime: (iso) => formatDateWith(iso, locale, { dateStyle: 'medium', timeStyle: 'short' }),
      relativeDate: (iso) => relative(iso, locale),
    };
  }, [preferences]);
}

function formatDateWith(
  iso: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function relative(iso: string, locale: string | undefined): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  if (days > 1 && days < 7) return `${days} days ago`;
  if (days < -1 && days > -7) return `In ${Math.abs(days)} days`;

  return formatDateWith(iso, locale, { dateStyle: 'medium' });
}

/** Bare volume number for input fields, in the user's own unit. */
export function toDisplayVolume(litres: number, unit: 'l' | 'gal_us' | 'gal_imp'): number {
  return round(fromLitres(litres, unit), 2);
}
