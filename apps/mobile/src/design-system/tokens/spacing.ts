/**
 * A 4pt spacing scale. Every margin and padding in the app comes from here, so
 * rhythm stays consistent without anyone having to remember specific numbers.
 */
export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  giant: 64,
} as const;

export type SpacingToken = keyof typeof SPACING;

/** Standard screen gutter. Wider on large screens so lines stay readable. */
export const SCREEN_PADDING = {
  compact: SPACING.base,
  medium: SPACING.xl,
  expanded: SPACING.xxl,
} as const;

/**
 * Minimum interactive size.
 *
 * 48dp is both the Material minimum and the WCAG 2.2 AA target size. Controls
 * that *look* smaller keep a 48dp hit area via `hitSlop` rather than shrinking
 * the touch target with the visual.
 */
export const TOUCH_TARGET = 48;

/**
 * Material 3 window size classes. Drive the layout switch to two-column on
 * tablets and unfolded foldables.
 */
export const BREAKPOINTS = {
  compact: 0,
  medium: 600,
  expanded: 840,
  large: 1200,
} as const;

export type WindowSizeClass = 'compact' | 'medium' | 'expanded' | 'large';

export function sizeClassFor(width: number): WindowSizeClass {
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}
