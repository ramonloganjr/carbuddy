import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { springConfig } from '../tokens/motion';
import { STATE_LAYER_OPACITY } from '../tokens/state';
import { withAlpha } from '../tokens/colors';

export interface StateLayerProps {
  /** Content colour of the host component — the layer is a wash of this. */
  color: string;
  pressed: SharedValue<number>;
  /** Persistent selection tint, drawn beneath the press layer. */
  selected?: boolean;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * The Material 3 state layer.
 *
 * A translucent wash of the component's own *content* colour, rather than a
 * fixed grey. That is what lets one implementation work on a filled button, an
 * outlined card and a dark-mode list row without any of them needing a special
 * case — the wash is always guaranteed to contrast with whatever it sits on,
 * because it is derived from the colour already proven legible there.
 */
export function StateLayer({
  color,
  pressed,
  selected = false,
  borderRadius = 0,
  style,
}: StateLayerProps) {
  const theme = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withSpring(
      pressed.value * STATE_LAYER_OPACITY.pressed,
      springConfig('fastEffects', theme.reduceMotion),
    ),
  }));

  return (
    <>
      {selected ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(color, STATE_LAYER_OPACITY.selected), borderRadius },
            style,
          ]}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: color, borderRadius },
          style,
          animatedStyle,
        ]}
      />
    </>
  );
}
