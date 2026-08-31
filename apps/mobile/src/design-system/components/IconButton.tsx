import React from 'react';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { SHAPE } from '../tokens/shape';
import { DISABLED_OPACITY } from '../tokens/state';
import { withAlpha } from '../tokens/colors';
import { TOUCH_TARGET } from '../tokens/spacing';

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined';

export interface IconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  /** Required: an icon-only control is unusable with a screen reader without it. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  selected?: boolean;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'standard',
  size = 24,
  selected = false,
  disabled = false,
  color,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const c = theme.colors;

  const { container, content, border } = (() => {
    switch (variant) {
      case 'filled':
        return selected
          ? { container: c.primary, content: c.onPrimary, border: undefined }
          : { container: c.surfaceContainerHighest, content: c.primary, border: undefined };
      case 'tonal':
        return {
          container: c.secondaryContainer,
          content: c.onSecondaryContainer,
          border: undefined,
        };
      case 'outlined':
        return { container: 'transparent', content: c.onSurfaceVariant, border: c.outline };
      case 'standard':
      default:
        return {
          container: 'transparent',
          content: selected ? c.primary : c.onSurfaceVariant,
          border: undefined,
        };
    }
  })();

  const contentColor = disabled
    ? withAlpha(c.onSurface, DISABLED_OPACITY.content)
    : (color ?? content);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      shape="full"
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      style={[
        {
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: SHAPE.full,
          backgroundColor:
            disabled && container !== 'transparent'
              ? withAlpha(c.onSurface, DISABLED_OPACITY.container)
              : container,
          ...(border ? { borderWidth: 1, borderColor: border } : {}),
        },
        style as ViewStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          {!disabled ? (
            <StateLayer color={contentColor} pressed={pressed} borderRadius={SHAPE.full} />
          ) : null}
          <MaterialIcons name={icon} size={size} color={contentColor} />
        </>
      )}
    </Pressable>
  );
}
