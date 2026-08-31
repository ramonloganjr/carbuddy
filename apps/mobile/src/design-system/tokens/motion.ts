import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * Material 3 Expressive motion.
 *
 * The defining change in Expressive motion is that movement is driven by
 * *springs* rather than fixed-duration curves. A spring settles based on where
 * the element currently is, so an interaction interrupted halfway continues
 * naturally instead of snapping back and restarting — which is what makes a
 * gesture-driven UI feel physical rather than scripted.
 *
 * Two families, and mixing them up is the usual mistake:
 *   - **Spatial** springs move things (position, size, rotation). They carry a
 *     slight overshoot, which is what reads as "expressive".
 *   - **Effects** springs change appearance (colour, opacity, elevation). They
 *     are critically damped — a colour that overshoots looks like a bug.
 */

export interface SpringToken {
  dampingRatio: number;
  stiffness: number;
}

export const SPRING = {
  fastSpatial: { dampingRatio: 0.9, stiffness: 1400 },
  defaultSpatial: { dampingRatio: 0.9, stiffness: 700 },
  slowSpatial: { dampingRatio: 0.9, stiffness: 300 },
  /** Pronounced overshoot for the hero moments: FAB expansion, sheet entry. */
  expressiveSpatial: { dampingRatio: 0.72, stiffness: 500 },

  fastEffects: { dampingRatio: 1, stiffness: 3800 },
  defaultEffects: { dampingRatio: 1, stiffness: 1600 },
  slowEffects: { dampingRatio: 1, stiffness: 800 },
} as const satisfies Record<string, SpringToken>;

export type SpringName = keyof typeof SPRING;

/** Durations for the few cases a fixed curve still beats a spring. */
export const DURATION = {
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
  long1: 450,
  long2: 500,
  long3: 550,
  long4: 600,
  extraLong1: 700,
  extraLong2: 800,
  extraLong3: 900,
  extraLong4: 1000,
} as const;

/** The Material easing set. `emphasized` is the default for most transitions. */
export const EASING = {
  emphasized: Easing.bezier(0.2, 0, 0, 1),
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
  emphasizedAccelerate: Easing.bezier(0.3, 0, 0.8, 0.15),
  standard: Easing.bezier(0.2, 0, 0, 1),
  standardDecelerate: Easing.bezier(0, 0, 0, 1),
  standardAccelerate: Easing.bezier(0.3, 0, 1, 1),
  linear: Easing.linear,
} as const;

/**
 * Build animation configs that honour the OS "reduce motion" setting.
 *
 * When reduce motion is on, transitions collapse to a very short cross-fade
 * rather than being removed entirely: the state change still needs to be
 * *perceptible*, it just must not move across the screen. Removing feedback
 * altogether makes an interface feel broken, which is not what the setting asks
 * for.
 */
/**
 * Convert a Material damping *ratio* into the damping *coefficient* Reanimated
 * wants.
 *
 * Material publishes its springs as (damping ratio, stiffness) because the
 * ratio is mass-independent and so describes the feel directly: 1.0 is
 * critically damped, below 1.0 overshoots. Reanimated's physics API instead
 * takes a raw damping coefficient, which depends on both stiffness and mass.
 * The standard relation for a mass-spring-damper is c = 2ζ√(km); with mass
 * fixed at 1 that reduces to 2ζ√k.
 *
 * Passing the ratio straight through as `damping` — an easy mistake, since both
 * are called "damping" — would produce a spring roughly fifty times too loose,
 * and every transition in the app would wobble.
 */
function toPhysics(ratio: number, stiffness: number, mass = 1) {
  return { damping: 2 * ratio * Math.sqrt(stiffness * mass), stiffness, mass };
}

export function springConfig(name: SpringName, reduceMotion: boolean): WithSpringConfig {
  if (reduceMotion) {
    // Effectively instant, but still a state change rather than a jump cut.
    return { ...toPhysics(1, 4000), overshootClamping: true };
  }
  const token = SPRING[name];
  return {
    ...toPhysics(token.dampingRatio, token.stiffness),
    // Spatial springs overshoot on purpose; effects springs must not.
    overshootClamping: token.dampingRatio >= 1,
  };
}

export function timingConfig(
  duration: keyof typeof DURATION,
  easing: keyof typeof EASING,
  reduceMotion: boolean,
): WithTimingConfig {
  return {
    duration: reduceMotion ? DURATION.short2 : DURATION[duration],
    easing: reduceMotion ? EASING.linear : EASING[easing],
  };
}

/**
 * Scale applied while a control is held.
 *
 * Kept subtle (4%) — enough to feel responsive under the thumb, not enough to
 * make a list of cards look like it is breathing.
 */
export const PRESS_SCALE = 0.96;
export const PRESS_SCALE_LARGE = 0.98;

/** Stagger between list items on entry, capped so long lists do not crawl. */
export function staggerDelay(index: number, step = 40, max = 320): number {
  return Math.min(index * step, max);
}
