import type { CurrencyCode, UUID } from './common/types.js';
import type { DistanceUnit, FuelEconomyStandard, PressureUnit, VolumeUnit } from './units/units.js';
import { presetForRegion } from './units/units.js';
import type { NotificationPreferences } from './reminders/types.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './reminders/types.js';

export type ThemeMode = 'system' | 'light' | 'dark';
export type DateFormat = 'system' | 'dmy' | 'mdy' | 'ymd';

export interface UserPreferences {
  readonly userId: UUID;
  readonly distanceUnit: DistanceUnit;
  readonly volumeUnit: VolumeUnit;
  readonly economyStandard: FuelEconomyStandard;
  readonly pressureUnit: PressureUnit;
  readonly currency: CurrencyCode;
  readonly locale?: string;
  readonly dateFormat: DateFormat;
  readonly themeMode: ThemeMode;
  /** Follow the OS accent colour where the platform supports it. */
  readonly dynamicColour: boolean;
  /** Mirrors the OS setting; the app also honours it directly. */
  readonly reduceMotion: boolean;
  readonly hapticsEnabled: boolean;
  /** Require Face ID / fingerprint to open the app. */
  readonly biometricLockEnabled: boolean;
  readonly notifications: NotificationPreferences;
  readonly defaultVehicleId?: UUID;
  readonly onboardingCompletedAt?: string;
}

/**
 * Preferences for a brand-new account, seeded from the device region so most
 * users never have to open the units screen at all.
 */
export function defaultPreferences(input: {
  userId: UUID;
  regionCode?: string;
  currency?: CurrencyCode;
  locale?: string;
  utcOffsetMinutes?: number;
}): UserPreferences {
  const preset = presetForRegion(input.regionCode);
  return {
    userId: input.userId,
    distanceUnit: preset.distance,
    volumeUnit: preset.volume,
    economyStandard: preset.economy,
    pressureUnit: preset.pressure,
    currency: input.currency ?? 'USD',
    ...(input.locale ? { locale: input.locale } : {}),
    dateFormat: 'system',
    themeMode: 'system',
    dynamicColour: true,
    reduceMotion: false,
    hapticsEnabled: true,
    biometricLockEnabled: false,
    notifications: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      utcOffsetMinutes: input.utcOffsetMinutes ?? 0,
    },
  };
}
