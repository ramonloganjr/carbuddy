import React, { useMemo } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable, type HapticStyle } from './Pressable';
import { StateLayer } from './StateLayer';
import { Text } from './Text';
import { SHAPE, type ShapeToken } from '../tokens/shape';
import { DISABLED_OPACITY } from '../tokens/state';
import { withAlpha } from '../tokens/colors';
import { TOUCH_TARGET } from '../tokens/spacing';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large' | 'extraLarge';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof MaterialIcons.glyphMap;
  trailingIcon?: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  shape?: ShapeToken;
  haptic?: HapticStyle;
  /**
   * Override the content colour. Needed on inverse surfaces (snackbars), where
   * the palette's `primary` was proven legible on `surface` and not on
   * `inverseSurface` — M3 specifies `inversePrimary` there instead.
   */
  contentColor?: string;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Height and padding per size.
 *
 * The Expressive size range goes considerably larger than classic Material —
 * `extraLarge` exists for the single most important action on a screen, such as
 * "Save fill-up" at the bottom of the entry sheet, where a big, obvious target
 * is genuinely better than an elegant one.
 */
const SIZES: Record<
  ButtonSize,
  { height: number; paddingH: number; gap: number; iconSize: number }
> = {
  small: { height: TOUCH_TARGET, paddingH: 16, gap: 8, iconSize: 18 },
  medium: { height: 56, paddingH: 24, gap: 8, iconSize: 20 },
  large: { height: 68, paddingH: 32, gap: 12, iconSize: 24 },
  extraLarge: { height: 80, paddingH: 40, gap: 12, iconSize: 28 },
};

const TEXT_VARIANT: Record<ButtonSize, 'labelLarge' | 'titleMedium' | 'titleLarge'> = {
  small: 'labelLarge',
  medium: 'labelLarge',
  large: 'titleMedium',
  extraLarge: 'titleLarge',
};

export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'medium',
  icon,
  trailingIcon,
  disabled = false,
  loading = false,
  fullWidth = false,
  shape = 'full',
  haptic = 'light',
  contentColor: contentColorOverride,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const dimensions = SIZES[size];
  const isInactive = disabled || loading;

  const palette = useMemo(() => {
    const c = theme.colors;
    switch (variant) {
      case 'filled':
        return { container: c.primary, content: c.onPrimary, border: undefined, level: 0 as const };
      case 'tonal':
        return {
          container: c.secondaryContainer,
          content: c.onSecondaryContainer,
          border: undefined,
          level: 0 as const,
        };
      case 'elevated':
        return {
          container: c.surfaceContainerLow,
          content: c.primary,
          border: undefined,
          level: 1 as const,
        };
      case 'outlined':
        return {
          container: 'transparent',
          content: c.primary,
          border: c.outline,
          level: 0 as const,
        };
      case 'text':
        return {
          container: 'transparent',
          content: c.primary,
          border: undefined,
          level: 0 as const,
        };
      case 'danger':
        return { container: c.error, content: c.onError, border: undefined, level: 0 as const };
    }
  }, [theme.colors, variant]);

  /**
   * Disabled uses Material's opacity treatment rather than a grey swap, so the
   * control keeps its shape and stays recognisable as the same button.
   */
  const containerColor = isInactive
    ? palette.container === 'transparent'
      ? 'transparent'
      : withAlpha(theme.colors.onSurface, DISABLED_OPACITY.container)
    : palette.container;

  const contentColor = isInactive
    ? withAlpha(theme.colors.onSurface, DISABLED_OPACITY.content)
    : (contentColorOverride ?? palette.content);

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      shape={shape}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // Announced to screen readers so a spinner is not silent.
      accessibilityState={{ disabled: isInactive, busy: loading }}
      testID={testID}
      style={[
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingH,
          backgroundColor: containerColor,
          borderRadius: SHAPE[shape],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ...(fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }),
          ...(palette.border && !isInactive
            ? { borderWidth: 1, borderColor: palette.border }
            : palette.border
              ? {
                  borderWidth: 1,
                  borderColor: withAlpha(theme.colors.onSurface, DISABLED_OPACITY.container),
                }
              : {}),
        },
        style as ViewStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          {!isInactive ? (
            <StateLayer color={contentColor} pressed={pressed} borderRadius={SHAPE[shape]} />
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: dimensions.gap,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={contentColor} />
            ) : icon ? (
              <MaterialIcons name={icon} size={dimensions.iconSize} color={contentColor} />
            ) : null}

            <Text variant={TEXT_VARIANT[size]} style={{ color: contentColor }} numberOfLines={1}>
              {label}
            </Text>

            {trailingIcon && !loading ? (
              <MaterialIcons name={trailingIcon} size={dimensions.iconSize} color={contentColor} />
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}
