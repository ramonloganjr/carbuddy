/**
 * Material 3 state-layer opacities.
 *
 * A "state layer" is a translucent wash of the content colour laid over a
 * component to signal hover/focus/press. Using the *content* colour rather than
 * a fixed grey is what makes the effect work on any surface, in either theme.
 */
export const STATE_LAYER_OPACITY = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.1,
  dragged: 0.16,
  /** Selected rows in a list or a chosen segmented-button segment. */
  selected: 0.12,
} as const;

export type InteractionState = keyof typeof STATE_LAYER_OPACITY;

/**
 * Disabled treatment. Material specifies 38% for content and 12% for a
 * container — never a grey swap, so disabled controls keep their shape and
 * remain recognisable.
 */
export const DISABLED_OPACITY = {
  content: 0.38,
  container: 0.12,
} as const;
