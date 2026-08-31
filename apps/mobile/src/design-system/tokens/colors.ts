import {
  Hct,
  MaterialDynamicColors,
  SchemeExpressive,
  SchemeVibrant,
  TonalPalette,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

/**
 * CarBuddy's Material 3 colour system.
 *
 * Every colour in the app is generated from a seed through Google's own
 * Material Color Utilities rather than hand-picked. That is what guarantees the
 * contrast relationships M3 promises: `onPrimary` is always legible on
 * `primary`, in light and dark, at any seed the user's wallpaper throws at us.
 * Hard-coding hex values would quietly break that the first time the palette
 * changed.
 */

/**
 * The brand seed: a deep, confident automotive blue. Trustworthy rather than
 * playful — this app holds someone's registration documents and spending.
 */
export const BRAND_SEED = '#0B57D0';

/**
 * Scheme variant for the brand palette.
 *
 * `Vibrant` rather than the `TonalSpot` default: TonalSpot desaturates the seed
 * heavily (our blue lands on a muted slate), which reads as generic. Vibrant
 * keeps the hue true and the chroma high, which is what "expressive" means for
 * a product with an actual brand colour. `SchemeExpressive` is reserved for
 * wallpaper-derived palettes, where a deliberate hue shift is the point.
 */
/** Semantic status seeds. Derived as M3 custom colours, not fixed hexes. */
const STATUS_SEEDS = {
  success: '#00696D',
  warning: '#7D5800',
  danger: '#B3261E',
  info: '#00639B',
} as const;

export type StatusRole = keyof typeof STATUS_SEEDS;

/** The standard Material 3 colour roles, including the M3 "fixed" set. */
export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  primaryFixed: string;
  primaryFixedDim: string;
  onPrimaryFixed: string;
  onPrimaryFixedVariant: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  secondaryFixed: string;
  secondaryFixedDim: string;
  onSecondaryFixed: string;
  onSecondaryFixedVariant: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  tertiaryFixed: string;
  tertiaryFixedDim: string;
  onTertiaryFixed: string;
  onTertiaryFixedVariant: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  background: string;
  onBackground: string;

  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceTint: string;

  /**
   * The five container tones M3 uses instead of elevation overlays. Depth in
   * Material 3 comes from tonal difference, not from stacked shadows.
   */
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  outline: string;
  outlineVariant: string;

  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;

  scrim: string;
  shadow: string;

  /** Custom semantic roles, generated the same way as the core ones. */
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;

  danger: string;
  onDanger: string;
  dangerContainer: string;
  onDangerContainer: string;

  info: string;
  onInfo: string;
  infoContainer: string;
  onInfoContainer: string;
}

/**
 * Build the four tones of a custom semantic colour, following the M3 custom
 * colour specification: 40/100/90/10 in light, 80/20/30/90 in dark.
 */
function customColorRoles(seedHex: string, isDark: boolean) {
  const palette = TonalPalette.fromInt(argbFromHex(seedHex));
  return isDark
    ? {
        color: hexFromArgb(palette.tone(80)),
        onColor: hexFromArgb(palette.tone(20)),
        container: hexFromArgb(palette.tone(30)),
        onContainer: hexFromArgb(palette.tone(90)),
      }
    : {
        color: hexFromArgb(palette.tone(40)),
        onColor: hexFromArgb(palette.tone(100)),
        container: hexFromArgb(palette.tone(90)),
        onContainer: hexFromArgb(palette.tone(10)),
      };
}

export interface SchemeOptions {
  seed?: string;
  isDark: boolean;
  /**
   * -1 reduced, 0 standard, 0.5 medium, 1 high. Wired to the OS "increase
   * contrast" accessibility setting so the whole palette responds to it, which
   * is far more effective than overriding individual colours.
   */
  contrastLevel?: number;
  /** Wallpaper-derived palettes use the Expressive variant. */
  dynamic?: boolean;
}

const cache = new Map<string, ColorScheme>();

export function buildColorScheme(options: SchemeOptions): ColorScheme {
  const { seed = BRAND_SEED, isDark, contrastLevel = 0, dynamic = false } = options;
  const key = `${seed}|${isDark}|${contrastLevel}|${dynamic}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const source = Hct.fromInt(argbFromHex(seed));
  const Variant = dynamic ? SchemeExpressive : SchemeVibrant;
  const scheme = new Variant(source, isDark, contrastLevel);
  const role = (name: keyof typeof MaterialDynamicColors): string =>
    hexFromArgb(
      (MaterialDynamicColors[name] as { getArgb: (s: unknown) => number }).getArgb(scheme),
    );

  const success = customColorRoles(STATUS_SEEDS.success, isDark);
  const warning = customColorRoles(STATUS_SEEDS.warning, isDark);
  const danger = customColorRoles(STATUS_SEEDS.danger, isDark);
  const info = customColorRoles(STATUS_SEEDS.info, isDark);

  const result: ColorScheme = {
    primary: role('primary'),
    onPrimary: role('onPrimary'),
    primaryContainer: role('primaryContainer'),
    onPrimaryContainer: role('onPrimaryContainer'),
    primaryFixed: role('primaryFixed'),
    primaryFixedDim: role('primaryFixedDim'),
    onPrimaryFixed: role('onPrimaryFixed'),
    onPrimaryFixedVariant: role('onPrimaryFixedVariant'),

    secondary: role('secondary'),
    onSecondary: role('onSecondary'),
    secondaryContainer: role('secondaryContainer'),
    onSecondaryContainer: role('onSecondaryContainer'),
    secondaryFixed: role('secondaryFixed'),
    secondaryFixedDim: role('secondaryFixedDim'),
    onSecondaryFixed: role('onSecondaryFixed'),
    onSecondaryFixedVariant: role('onSecondaryFixedVariant'),

    tertiary: role('tertiary'),
    onTertiary: role('onTertiary'),
    tertiaryContainer: role('tertiaryContainer'),
    onTertiaryContainer: role('onTertiaryContainer'),
    tertiaryFixed: role('tertiaryFixed'),
    tertiaryFixedDim: role('tertiaryFixedDim'),
    onTertiaryFixed: role('onTertiaryFixed'),
    onTertiaryFixedVariant: role('onTertiaryFixedVariant'),

    error: role('error'),
    onError: role('onError'),
    errorContainer: role('errorContainer'),
    onErrorContainer: role('onErrorContainer'),

    background: role('background'),
    onBackground: role('onBackground'),

    surface: role('surface'),
    onSurface: role('onSurface'),
    surfaceVariant: role('surfaceVariant'),
    onSurfaceVariant: role('onSurfaceVariant'),
    surfaceDim: role('surfaceDim'),
    surfaceBright: role('surfaceBright'),
    surfaceTint: role('surfaceTint'),

    surfaceContainerLowest: role('surfaceContainerLowest'),
    surfaceContainerLow: role('surfaceContainerLow'),
    surfaceContainer: role('surfaceContainer'),
    surfaceContainerHigh: role('surfaceContainerHigh'),
    surfaceContainerHighest: role('surfaceContainerHighest'),

    outline: role('outline'),
    outlineVariant: role('outlineVariant'),

    inverseSurface: role('inverseSurface'),
    inverseOnSurface: role('inverseOnSurface'),
    inversePrimary: role('inversePrimary'),

    scrim: role('scrim'),
    shadow: role('shadow'),

    success: success.color,
    onSuccess: success.onColor,
    successContainer: success.container,
    onSuccessContainer: success.onContainer,

    warning: warning.color,
    onWarning: warning.onColor,
    warningContainer: warning.container,
    onWarningContainer: warning.onContainer,

    danger: danger.color,
    onDanger: danger.onColor,
    dangerContainer: danger.container,
    onDangerContainer: danger.onContainer,

    info: info.color,
    onInfo: info.onColor,
    infoContainer: info.container,
    onInfoContainer: info.onContainer,
  };

  cache.set(key, result);
  return result;
}

/** Add an alpha channel to a `#RRGGBB` token. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  const normalised = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${normalised}${clamped.toString(16).padStart(2, '0')}`;
}

/**
 * Map a domain status onto its colour pair.
 *
 * Centralised so that "overdue" is the same colour on the dashboard, in the
 * list, and in the detail sheet. Colour is never the only signal — every caller
 * pairs this with an icon and a text label.
 */
export type SemanticStatus = 'ok' | 'due_soon' | 'due' | 'overdue' | 'unknown';

export function statusColors(
  scheme: ColorScheme,
  status: SemanticStatus,
): { container: string; onContainer: string; accent: string } {
  switch (status) {
    case 'overdue':
    case 'due':
      return {
        container: scheme.errorContainer,
        onContainer: scheme.onErrorContainer,
        accent: scheme.error,
      };
    case 'due_soon':
      return {
        container: scheme.warningContainer,
        onContainer: scheme.onWarningContainer,
        accent: scheme.warning,
      };
    case 'ok':
      return {
        container: scheme.successContainer,
        onContainer: scheme.onSuccessContainer,
        accent: scheme.success,
      };
    case 'unknown':
      return {
        container: scheme.surfaceContainerHigh,
        onContainer: scheme.onSurfaceVariant,
        accent: scheme.outline,
      };
  }
}
