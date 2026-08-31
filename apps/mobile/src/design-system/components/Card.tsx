import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { Surface } from './Surface';
import { SHAPE, type ShapeToken } from '../tokens/shape';
import { elevation } from '../tokens/elevation';

export type CardVariant = 'filled' | 'elevated' | 'outlined';

export interface CardProps {
  variant?: CardVariant;
  shape?: ShapeToken;
  onPress?: () => void;
  padding?: number;
  background?: string;
  style?: ViewStyle;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Material 3 card.
 *
 * A tappable card routes through `Pressable` so it gets the state layer, scale
 * and shape morph; a static card renders as a plain `Surface` with no
 * interactive affordance at all. Keeping those genuinely distinct matters for
 * screen-reader users, who otherwise hear "button" on every decorative panel.
 */
export function Card({
  variant = 'filled',
  shape = 'extraLarge',
  onPress,
  padding = 16,
  background,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const theme = useTheme();

  const surfaceColor =
    background ??
    (variant === 'elevated' ? theme.colors.surfaceContainerLow : theme.colors.surfaceContainer);

  if (!onPress) {
    return (
      <Surface
        level={variant === 'elevated' ? 1 : 0}
        shape={shape}
        outlined={variant === 'outlined'}
        background={variant === 'outlined' ? theme.colors.surface : surfaceColor}
        style={[{ padding }, style as ViewStyle]}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </Surface>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      shape={shape}
      haptic="light"
      scaleOnPress={0.985}
      ensureTouchTarget={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        {
          padding,
          borderRadius: SHAPE[shape],
          backgroundColor: variant === 'outlined' ? theme.colors.surface : surfaceColor,
          ...(variant === 'outlined'
            ? { borderWidth: 1, borderColor: theme.colors.outlineVariant }
            : variant === 'elevated'
              ? elevation(1, theme.colors.shadow)
              : {}),
        },
        style as ViewStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          <StateLayer
            color={theme.colors.onSurface}
            pressed={pressed}
            borderRadius={SHAPE[shape]}
          />
          <View>{children}</View>
        </>
      )}
    </Pressable>
  );
}
