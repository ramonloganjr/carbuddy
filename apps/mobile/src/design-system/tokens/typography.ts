import { PixelRatio, Platform, type TextStyle } from 'react-native';

/**
 * The Material 3 Expressive type scale.
 *
 * Expressive typography is the loudest signal of the M3 Expressive language:
 * bigger, tighter display sizes at the top of a screen, and a much wider range
 * between the largest and smallest step than classic Material had. The
 * `Emphasized` variants are the Expressive addition — heavier weights used for
 * the one element on a screen that should dominate.
 */

export type TypeRole =
  | 'displayLarge'
  | 'displayMedium'
  | 'displaySmall'
  | 'headlineLarge'
  | 'headlineMedium'
  | 'headlineSmall'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall'
  | 'displayLargeEmphasized'
  | 'displayMediumEmphasized'
  | 'headlineLargeEmphasized'
  | 'headlineMediumEmphasized'
  | 'titleLargeEmphasized'
  | 'labelLargeEmphasized'
  /** Tabular figures for money and odometer readings. */
  | 'numericLarge'
  | 'numericMedium'
  | 'numericSmall';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: TextStyle['fontWeight'];
  /** Steps above which the app stops scaling to protect the layout. */
  maxFontSizeMultiplier: number;
  fontVariant?: TextStyle['fontVariant'];
}

/**
 * `maxFontSizeMultiplier` is set per role rather than globally.
 *
 * Body text is allowed to grow a long way, because that is where accessibility
 * actually matters — someone with low vision needs to read the notes on a
 * service record. Display text is capped harder: it is already large, and
 * letting a 57pt headline triple in size pushes everything else off screen,
 * which helps nobody. Nothing is capped below 1.3, which keeps the app usable
 * at the OS's larger accessibility sizes.
 */
export const TYPE_SCALE: Record<TypeRole, TypeStyle> = {
  displayLarge: {
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.3,
  },
  displayMedium: {
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.3,
  },
  displaySmall: {
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.4,
  },

  headlineLarge: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.5,
  },
  headlineMedium: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.5,
  },
  headlineSmall: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
    fontWeight: '400',
    maxFontSizeMultiplier: 1.6,
  },

  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
    fontWeight: '500',
    maxFontSizeMultiplier: 1.7,
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
  },
  titleSmall: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
  },

  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
    fontWeight: '400',
    maxFontSizeMultiplier: 2,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    fontWeight: '400',
    maxFontSizeMultiplier: 2,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    fontWeight: '400',
    maxFontSizeMultiplier: 2,
  },

  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
  },

  // Expressive emphasis — heavier and tighter, for the single dominant element.
  displayLargeEmphasized: {
    fontSize: 57,
    lineHeight: 62,
    letterSpacing: -0.5,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.3,
  },
  displayMediumEmphasized: {
    fontSize: 45,
    lineHeight: 50,
    letterSpacing: -0.25,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.3,
  },
  headlineLargeEmphasized: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.25,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.5,
  },
  headlineMediumEmphasized: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.15,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.5,
  },
  titleLargeEmphasized: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.7,
  },
  labelLargeEmphasized: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.8,
  },

  /**
   * Tabular figures. Without `tabular-nums`, a column of costs jitters as the
   * digits change width — very visible in the expense list and on any chart
   * axis.
   */
  numericLarge: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.4,
    fontVariant: ['tabular-nums'],
  },
  numericMedium: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.25,
    fontWeight: '700',
    maxFontSizeMultiplier: 1.6,
    fontVariant: ['tabular-nums'],
  },
  numericSmall: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.8,
    fontVariant: ['tabular-nums'],
  },
};

/**
 * Platform system fonts.
 *
 * Deliberately not a bundled custom face. System fonts respect the user's own
 * font-size and font-weight accessibility settings, render with the right
 * optical sizing on each platform, and add nothing to the download. The
 * expressive character comes from the scale, weight and spacing above.
 */
export const FONT_FAMILY = Platform.select({
  ios: { regular: 'System', medium: 'System', bold: 'System' },
  android: { regular: 'sans-serif', medium: 'sans-serif-medium', bold: 'sans-serif' },
  default: { regular: 'System', medium: 'System', bold: 'System' },
});

export function typeStyle(role: TypeRole): TextStyle {
  const token = TYPE_SCALE[role];
  return {
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    fontWeight: token.fontWeight,
    ...(token.fontVariant ? { fontVariant: token.fontVariant } : {}),
  };
}

/**
 * Line height that survives OS font scaling.
 *
 * React Native does not scale `lineHeight` with `fontSize`, so at large
 * accessibility sizes text overlaps its own line box. Recomputing it from the
 * live scale keeps multi-line text readable instead of collapsing.
 */
export function scaledLineHeight(role: TypeRole): number {
  const token = TYPE_SCALE[role];
  const scale = Math.min(PixelRatio.getFontScale(), token.maxFontSizeMultiplier);
  return Math.round(token.lineHeight * scale);
}
