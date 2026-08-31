import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { IconButton } from './IconButton';
import { SHAPE } from '../tokens/shape';
import { timingConfig } from '../tokens/motion';
import { TYPE_SCALE } from '../tokens/typography';

/**
 * Derived from `TextInputProps` rather than named directly: React Native
 * renamed these payload types in 0.81, and deriving keeps the component
 * compiling across versions instead of pinning to whichever name is current.
 */
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'onChange'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  variant?: 'outlined' | 'filled';
  /** Helper text below the field. Replaced by `error` when one is present. */
  supportingText?: string;
  error?: string;
  leadingIcon?: keyof typeof MaterialIcons.glyphMap;
  trailingIcon?: keyof typeof MaterialIcons.glyphMap;
  onTrailingIconPress?: () => void;
  trailingIconLabel?: string;
  /** Unit shown inside the field, e.g. `km`, `L`, `USD`. */
  suffix?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  testID?: string;
}

/**
 * Material 3 text field with a floating label.
 *
 * Accessibility details that are easy to miss and matter a lot here:
 *   - The visual floating label is `accessibilityElementsHidden`, with the label
 *     passed through `accessibilityLabel` on the input instead. Otherwise a
 *     screen reader announces the label twice.
 *   - Errors are announced via `accessibilityLiveRegion`, so a validation
 *     failure is heard rather than only seen.
 *   - The error state adds an icon as well as red, because colour alone is not
 *     a sufficient signal.
 */
export function TextField({
  label,
  value,
  onChangeText,
  variant = 'outlined',
  supportingText,
  error,
  leadingIcon,
  trailingIcon,
  onTrailingIconPress,
  trailingIconLabel,
  suffix,
  required = false,
  containerStyle,
  editable = true,
  multiline = false,
  testID,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const floating = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    floating.value = focused || value.length > 0 ? 1 : 0;
  }, [floating, focused, value]);

  const handleFocus = useCallback<FocusHandler>(
    (event) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback<BlurHandler>(
    (event) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  const c = theme.colors;
  const hasError = Boolean(error);
  const borderColor = hasError ? c.error : focused ? c.primary : c.outline;
  const labelColor = hasError ? c.error : focused ? c.primary : c.onSurfaceVariant;

  const labelStyle = useAnimatedStyle(() => {
    const config = timingConfig('short4', 'emphasized', theme.reduceMotion);
    const progress = withTiming(floating.value, config);
    return {
      transform: [
        { translateY: interpolate(progress, [0, 1], [0, multiline ? -10 : -18]) },
        { scale: interpolate(progress, [0, 1], [1, 0.75]) },
      ],
    };
  });

  const minHeight = multiline ? 120 : 56;

  return (
    <View style={[{ gap: 4 }, containerStyle as ViewStyle]}>
      <View
        style={{
          minHeight,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          paddingHorizontal: 16,
          paddingTop: multiline ? 20 : 0,
          gap: 12,
          borderRadius: variant === 'outlined' ? SHAPE.extraSmall : SHAPE.extraSmall,
          backgroundColor: variant === 'filled' ? c.surfaceContainerHighest : 'transparent',
          borderWidth: variant === 'outlined' ? (focused || hasError ? 2 : 1) : 0,
          borderBottomWidth: variant === 'filled' ? (focused || hasError ? 2 : 1) : undefined,
          borderColor,
          opacity: editable ? 1 : 0.38,
        }}
      >
        {leadingIcon ? (
          <MaterialIcons name={leadingIcon} size={24} color={c.onSurfaceVariant} />
        ) : null}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              {
                position: 'absolute',
                left: 0,
                // Sits on the border when floated, matching the M3 notch.
                backgroundColor: variant === 'outlined' ? c.surface : 'transparent',
                paddingHorizontal: variant === 'outlined' ? 4 : 0,
                marginLeft: variant === 'outlined' ? -4 : 0,
              },
              labelStyle,
            ]}
          >
            <Text variant="bodyLarge" style={{ color: labelColor }}>
              {required ? `${label} *` : label}
            </Text>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              {...rest}
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              editable={editable}
              multiline={multiline}
              testID={testID}
              accessibilityLabel={required ? `${label}, required` : label}
              accessibilityHint={error ?? supportingText}
              placeholderTextColor={c.onSurfaceVariant}
              selectionColor={c.primary}
              maxFontSizeMultiplier={TYPE_SCALE.bodyLarge.maxFontSizeMultiplier}
              style={{
                flex: 1,
                paddingTop: multiline ? 0 : 18,
                paddingBottom: multiline ? 12 : 4,
                fontSize: TYPE_SCALE.bodyLarge.fontSize,
                lineHeight: multiline ? TYPE_SCALE.bodyLarge.lineHeight : undefined,
                color: c.onSurface,
                textAlignVertical: multiline ? 'top' : 'center',
              }}
            />
            {suffix ? (
              <Text variant="bodyMedium" color="onSurfaceVariant" style={{ paddingTop: 14 }}>
                {suffix}
              </Text>
            ) : null}
          </View>
        </View>

        {trailingIcon ? (
          <IconButton
            icon={trailingIcon}
            accessibilityLabel={trailingIconLabel ?? 'Field action'}
            onPress={onTrailingIconPress}
            size={20}
            style={{ width: 32, height: 32 }}
          />
        ) : null}
      </View>

      {error || supportingText ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 }}
          accessibilityLiveRegion={hasError ? 'polite' : 'none'}
        >
          {hasError ? <MaterialIcons name="error-outline" size={14} color={c.error} /> : null}
          <Text
            variant="bodySmall"
            color={hasError ? 'error' : 'onSurfaceVariant'}
            style={{ flex: 1 }}
          >
            {error ?? supportingText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
