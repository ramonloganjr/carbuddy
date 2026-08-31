import { Platform, type ViewStyle } from 'react-native';
import { withAlpha } from './colors';

/**
 * Material 3 elevation.
 *
 * M3 conveys depth primarily through *tonal* surface colour rather than
 * shadows, which is why every raised component here pairs a surface-container
 * tone with a comparatively restrained shadow. Shadows still matter for
 * genuinely floating things (FAB, menus, sheets) where the surface underneath
 * can be any colour.
 *
 * The two platforms render shadows through completely different primitives —
 * `shadow*` on iOS, `elevation` on Android — so both are emitted and each
 * platform ignores the other.
 */

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

const IOS_SHADOWS: Record<ElevationLevel, { height: number; radius: number; opacity: number }> = {
  0: { height: 0, radius: 0, opacity: 0 },
  1: { height: 1, radius: 3, opacity: 0.14 },
  2: { height: 2, radius: 6, opacity: 0.16 },
  3: { height: 4, radius: 10, opacity: 0.18 },
  4: { height: 6, radius: 14, opacity: 0.2 },
  5: { height: 8, radius: 20, opacity: 0.22 },
};

export function elevation(level: ElevationLevel, shadowColor = '#000000'): ViewStyle {
  if (level === 0) return Platform.OS === 'android' ? { elevation: 0 } : {};

  const token = IOS_SHADOWS[level];
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOffset: { width: 0, height: token.height },
      shadowRadius: token.radius,
      shadowOpacity: token.opacity,
    },
    android: {
      elevation: level * 2,
      shadowColor: withAlpha(shadowColor, 0.6),
    },
    default: {},
  }) as ViewStyle;
}

/**
 * Which surface-container tone belongs at each elevation.
 *
 * Using this instead of a translucent white overlay is what makes dark mode
 * look right: an overlay washes colour out, whereas the container tones are
 * generated from the palette and stay in the same hue family.
 */
export const SURFACE_AT_ELEVATION = {
  0: 'surface',
  1: 'surfaceContainerLow',
  2: 'surfaceContainer',
  3: 'surfaceContainerHigh',
  4: 'surfaceContainerHigh',
  5: 'surfaceContainerHighest',
} as const;
