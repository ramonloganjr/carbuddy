/**
 * Material 3 Expressive shape tokens.
 *
 * Expressive Material leans much harder on shape than classic Material did:
 * larger corner radii, full-round pills for actions, and — importantly —
 * *shape change as feedback*, where a component morphs on press rather than
 * only dimming. The `pressed` variants below exist for that.
 */

export const SHAPE = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  largeIncreased: 20,
  extraLarge: 28,
  extraLargeIncreased: 32,
  /** Expressive hero surfaces — the dashboard vehicle card. */
  extraExtraLarge: 48,
  /** Pill. Any value larger than half the height renders fully round. */
  full: 999,
} as const;

export type ShapeToken = keyof typeof SHAPE;

/**
 * Press-state shape targets.
 *
 * A button squaring off slightly under the thumb is the signature Expressive
 * interaction: it reads as physical give, and it stays perceptible for users
 * who cannot easily see a subtle colour change in the state layer.
 */
export const SHAPE_PRESSED: Partial<Record<ShapeToken, number>> = {
  full: SHAPE.large,
  extraExtraLarge: SHAPE.extraLargeIncreased,
  extraLarge: SHAPE.largeIncreased,
  extraLargeIncreased: SHAPE.extraLarge,
  largeIncreased: SHAPE.medium,
  large: SHAPE.medium,
  medium: SHAPE.small,
};

/** Corner radii for a vertical group, so a list reads as one object. */
export function groupedCorners(
  index: number,
  total: number,
  radius: number = SHAPE.large,
  innerRadius: number = SHAPE.extraSmall,
) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return {
    borderTopLeftRadius: isFirst ? radius : innerRadius,
    borderTopRightRadius: isFirst ? radius : innerRadius,
    borderBottomLeftRadius: isLast ? radius : innerRadius,
    borderBottomRightRadius: isLast ? radius : innerRadius,
  };
}
