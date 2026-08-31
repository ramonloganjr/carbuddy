import { create } from 'zustand';
import * as Localization from 'expo-localization';
import { defaultPreferences, presetForRegion, type UserPreferences } from '@carbuddy/domain';
import { getDatabase } from '../../data/db/database';

/**
 * User preferences, held in memory and mirrored to SQLite.
 *
 * Kept in a store rather than fetched per screen because units and currency
 * affect nearly every rendered value — a re-read on each component would be
 * both slow and a source of flicker when the user changes a unit.
 */
interface PreferencesState {
  preferences: UserPreferences | null;
  loading: boolean;
  load: (userId: string) => Promise<void>;
  update: (patch: Partial<UserPreferences>) => Promise<void>;
  reset: () => void;
}

interface PreferencesRow {
  user_id: string;
  distance_unit: string;
  volume_unit: string;
  economy_standard: string;
  pressure_unit: string;
  currency: string;
  locale: string | null;
  date_format: string;
  theme_mode: string;
  dynamic_colour: number;
  reduce_motion: number;
  haptics_enabled: number;
  biometric_lock: number;
  notifications_json: string;
  default_vehicle_id: string | null;
  onboarding_done_at: string | null;
}

/**
 * Seed preferences from the device locale.
 *
 * A user in the US should see MPG and dollars before they open a settings
 * screen; a user in Germany should see L/100 km and euros. Getting this right
 * on first launch removes the single most common early friction point.
 */
function seedFromDevice(userId: string): UserPreferences {
  const primary = Localization.getLocales()[0];

  return defaultPreferences({
    userId,
    regionCode: primary?.regionCode ?? undefined,
    currency: primary?.currencyCode ?? undefined,
    locale: primary?.languageTag ?? undefined,
    // `getTimezoneOffset` is minutes *behind* UTC, the opposite sign of the
    // "minutes east of UTC" the notification planner expects.
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  preferences: null,
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<PreferencesRow>(
        'SELECT * FROM user_preferences WHERE user_id = ?;',
        [userId],
      );

      if (!row) {
        const seeded = seedFromDevice(userId);
        await persist(seeded);
        set({ preferences: seeded, loading: false });
        return;
      }

      set({
        preferences: {
          userId: row.user_id,
          distanceUnit: row.distance_unit as UserPreferences['distanceUnit'],
          volumeUnit: row.volume_unit as UserPreferences['volumeUnit'],
          economyStandard: row.economy_standard as UserPreferences['economyStandard'],
          pressureUnit: row.pressure_unit as UserPreferences['pressureUnit'],
          currency: row.currency,
          ...(row.locale ? { locale: row.locale } : {}),
          dateFormat: row.date_format as UserPreferences['dateFormat'],
          themeMode: row.theme_mode as UserPreferences['themeMode'],
          dynamicColour: row.dynamic_colour === 1,
          reduceMotion: row.reduce_motion === 1,
          hapticsEnabled: row.haptics_enabled === 1,
          biometricLockEnabled: row.biometric_lock === 1,
          notifications: JSON.parse(row.notifications_json) as UserPreferences['notifications'],
          ...(row.default_vehicle_id ? { defaultVehicleId: row.default_vehicle_id } : {}),
          ...(row.onboarding_done_at ? { onboardingCompletedAt: row.onboarding_done_at } : {}),
        },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  update: async (patch) => {
    const current = get().preferences;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ preferences: next });
    await persist(next);
  },

  reset: () => set({ preferences: null, loading: false }),
}));

async function persist(preferences: UserPreferences): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO user_preferences (
       user_id, distance_unit, volume_unit, economy_standard, pressure_unit, currency, locale,
       date_format, theme_mode, dynamic_colour, reduce_motion, haptics_enabled, biometric_lock,
       notifications_json, default_vehicle_id, onboarding_done_at, version, updated_at, created_at, dirty
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET
       distance_unit = excluded.distance_unit,
       volume_unit = excluded.volume_unit,
       economy_standard = excluded.economy_standard,
       pressure_unit = excluded.pressure_unit,
       currency = excluded.currency,
       locale = excluded.locale,
       date_format = excluded.date_format,
       theme_mode = excluded.theme_mode,
       dynamic_colour = excluded.dynamic_colour,
       reduce_motion = excluded.reduce_motion,
       haptics_enabled = excluded.haptics_enabled,
       biometric_lock = excluded.biometric_lock,
       notifications_json = excluded.notifications_json,
       default_vehicle_id = excluded.default_vehicle_id,
       onboarding_done_at = excluded.onboarding_done_at,
       updated_at = excluded.updated_at,
       dirty = 1;`,
    [
      preferences.userId,
      preferences.distanceUnit,
      preferences.volumeUnit,
      preferences.economyStandard,
      preferences.pressureUnit,
      preferences.currency,
      preferences.locale ?? null,
      preferences.dateFormat,
      preferences.themeMode,
      preferences.dynamicColour ? 1 : 0,
      preferences.reduceMotion ? 1 : 0,
      preferences.hapticsEnabled ? 1 : 0,
      preferences.biometricLockEnabled ? 1 : 0,
      JSON.stringify(preferences.notifications),
      preferences.defaultVehicleId ?? null,
      preferences.onboardingCompletedAt ?? null,
      now,
      now,
    ],
  );
}

/** Unit defaults for a region — used by the onboarding units step. */
export { presetForRegion };
