import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';
import { springConfig } from '../tokens/motion';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  supportingText?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Material 3 switch, as a full labelled row.
 *
 * The whole row is the target rather than just the thumb: a 32×20 switch is a
 * poor touch target, and the label is what the user is actually aiming at. The
 * selected state shows a check inside the thumb — the M3 pattern, and a
 * non-colour signal of on/off.
 */
export function Switch({
  value,
  onValueChange,
  label,
  supportingText,
  disabled = false,
  testID,
}: SwitchProps) {
  const theme = useTheme();
  const c = theme.colors;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(value ? 20 : 0, springConfig('fastSpatial', theme.reduceMotion)) },
    ],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      haptic="selection"
      shape="medium"
      ensureTouchTarget={false}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={supportingText}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 56,
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyLarge">{label}</Text>
        {supportingText ? (
          <Text variant="bodySmall" color="onSurfaceVariant">
            {supportingText}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: SHAPE.full,
          padding: 4,
          justifyContent: 'center',
          backgroundColor: value ? c.primary : c.surfaceContainerHighest,
          borderWidth: value ? 0 : 2,
          borderColor: c.outline,
        }}
      >
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: value ? c.onPrimary : c.outline,
            },
            thumbStyle,
          ]}
        >
          {value ? <MaterialIcons name="check" size={16} color={c.primary} /> : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}
