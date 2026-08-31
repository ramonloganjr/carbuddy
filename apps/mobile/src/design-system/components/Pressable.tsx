import React, { useCallback } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { springConfig, PRESS_SCALE } from '../tokens/motion';
import { SHAPE_PRESSED, type ShapeToken, SHAPE } from '../tokens/shape';
import { TOUCH_TARGET } from '../tokens/spacing';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type HapticStyle =
  'none' | 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export interface PressableProps extends Omit<RNPressableProps, 'style' | 'children'> {
  children: React.ReactNode | ((state: { pressed: SharedValue<number> }) => React.ReactNode);
  style?: ViewStyle | ViewStyle[];
  /** Shape token; the component morphs toward its pressed radius while held. */
  shape?: ShapeToken;
  scaleOnPress?: number;
  haptic?: HapticStyle;
  /** Guarantees a 48dp touch target even when the visual is smaller. */
  ensureTouchTarget?: boolean;
}

async function triggerHaptic(style: HapticStyle) {
  try {
    switch (style) {
      case 'none':
        return;
      case 'selection':
        return await Haptics.selectionAsync();
      case 'success':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'light':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    // Haptics are unavailable on some devices and in the simulator. Never let
    // missing feedback break the actual interaction.
  }
}

/**
 * The interaction primitive every tappable surface is built from.
 *
 * Bundles the three things Material 3 Expressive expects on press — a state
 * layer driver, a scale response, and a *shape morph* — plus haptics and a
 * guaranteed minimum touch target. Centralising it means no screen can
 * accidentally ship a control that is 32dp tall or that gives no feedback.
 *
 * The `pressed` shared value is handed to children so a component can drive its
 * own state layer without a re-render on every touch.
 */
export function Pressable({
  children,
  style,
  shape = 'full',
  scaleOnPress = PRESS_SCALE,
  haptic = 'light',
  ensureTouchTarget = true,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  hitSlop,
  ...rest
}: PressableProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const restRadius = SHAPE[shape];
  const pressedRadius = SHAPE_PRESSED[shape] ?? restRadius;

  const handlePressIn = useCallback<NonNullable<RNPressableProps['onPressIn']>>(
    (event) => {
      pressed.value = 1;
      onPressIn?.(event);
    },
    [onPressIn, pressed],
  );

  const handlePressOut = useCallback<NonNullable<RNPressableProps['onPressOut']>>(
    (event) => {
      pressed.value = 0;
      onPressOut?.(event);
    },
    [onPressOut, pressed],
  );

  const handlePress = useCallback<NonNullable<RNPressableProps['onPress']>>(
    (event) => {
      if (haptic !== 'none') void triggerHaptic(haptic);
      onPress?.(event);
    },
    [haptic, onPress],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const spatial = springConfig('fastSpatial', theme.reduceMotion);
    return {
      transform: [
        {
          // Reduced motion keeps the state layer and shape change but drops the
          // movement, which is the part the setting is actually about.
          scale: theme.reduceMotion
            ? 1
            : withSpring(1 - pressed.value * (1 - scaleOnPress), spatial),
        },
      ],
      borderRadius: withSpring(restRadius + pressed.value * (pressedRadius - restRadius), spatial),
    };
  });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={hitSlop ?? (ensureTouchTarget ? 8 : undefined)}
      style={[
        ensureTouchTarget ? { minHeight: TOUCH_TARGET, justifyContent: 'center' } : null,
        { overflow: 'hidden' },
        style as ViewStyle,
        animatedStyle,
      ]}
      accessibilityState={{ disabled: !!disabled, ...(rest.accessibilityState ?? {}) }}
    >
      {typeof children === 'function' ? children({ pressed }) : children}
    </AnimatedPressable>
  );
}
