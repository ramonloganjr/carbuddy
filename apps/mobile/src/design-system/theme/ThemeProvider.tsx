import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme, useWindowDimensions } from 'react-native';
import type { ThemeMode } from '@carbuddy/domain';
import { BRAND_SEED, buildColorScheme, type ColorScheme } from '../tokens/colors';
import { SPACING, SCREEN_PADDING, sizeClassFor, type WindowSizeClass } from '../tokens/spacing';
import { SHAPE } from '../tokens/shape';
import { TYPE_SCALE } from '../tokens/typography';

export interface Theme {
  colors: ColorScheme;
  isDark: boolean;
  /** Mirrors the OS setting; every animated component must consult it. */
  reduceMotion: boolean;
  spacing: typeof SPACING;
  shape: typeof SHAPE;
  type: typeof TYPE_SCALE;
  /** Layout bucket driving single- vs two-column screens. */
  sizeClass: WindowSizeClass;
  screenPadding: number;
}

export interface ThemeSettings {
  mode: ThemeMode;
  /** Seed the palette from elsewhere (e.g. Android wallpaper colours). */
  seed?: string;
  dynamic?: boolean;
  /** -1 to 1, wired to the OS contrast setting. */
  contrastLevel?: number;
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  settings: ThemeSettings;
  children: React.ReactNode;
}

export function ThemeProvider({ settings, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  /**
   * Read the accessibility setting once and subscribe to changes. Users toggle
   * reduce-motion while the app is open — often *because* an animation bothered
   * them — so responding live matters more than it might seem.
   */
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const isDark = settings.mode === 'system' ? systemScheme === 'dark' : settings.mode === 'dark';

  const theme = useMemo<Theme>(() => {
    const sizeClass = sizeClassFor(width);
    return {
      colors: buildColorScheme({
        seed: settings.seed ?? BRAND_SEED,
        isDark,
        contrastLevel: settings.contrastLevel ?? 0,
        dynamic: settings.dynamic ?? false,
      }),
      isDark,
      reduceMotion,
      spacing: SPACING,
      shape: SHAPE,
      type: TYPE_SCALE,
      sizeClass,
      screenPadding:
        sizeClass === 'compact'
          ? SCREEN_PADDING.compact
          : sizeClass === 'medium'
            ? SCREEN_PADDING.medium
            : SCREEN_PADDING.expanded,
    };
  }, [isDark, reduceMotion, settings.seed, settings.contrastLevel, settings.dynamic, width]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside a <ThemeProvider>. Wrap the app root.');
  }
  return theme;
}

/**
 * Build a StyleSheet from the theme without re-creating it on every render.
 *
 * `useMemo` keyed on the theme keeps style objects referentially stable, which
 * matters for the memoised list rows in the fuel and expense screens.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
