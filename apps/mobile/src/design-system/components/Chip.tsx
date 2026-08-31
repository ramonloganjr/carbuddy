import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';
import { DISABLED_OPACITY } from '../tokens/state';
import { withAlpha } from '../tokens/colors';

export type ChipVariant = 'assist' | 'filter' | 'input' | 'suggestion';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  onClose?: () => void;
  variant?: ChipVariant;
  icon?: keyof typeof MaterialIcons.glyphMap;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Chip({
  label,
  onPress,
  onClose,
  variant = 'assist',
  icon,
  selected = false,
  disabled = false,
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const c = theme.colors;

  const container = selected ? c.secondaryContainer : c.surfaceContainerLow;
  const content = disabled
    ? withAlpha(c.onSurface, DISABLED_OPACITY.content)
    : selected
      ? c.onSecondaryContainer
      : c.onSurfaceVariant;

  // Filter chips swap their leading icon for a check when selected — the
  // Material pattern, and a non-colour signal of state.
  const leadingIcon = variant === 'filter' && selected ? 'check' : icon;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      shape="small"
      haptic="selection"
      ensureTouchTarget={false}
      accessibilityRole={variant === 'filter' ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      testID={testID}
      style={[
        {
          height: 40,
          minHeight: 40,
          paddingLeft: leadingIcon ? 12 : 16,
          paddingRight: onClose ? 8 : 16,
          borderRadius: SHAPE.small,
          backgroundColor: selected ? container : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          ...(selected
            ? {}
            : {
                borderWidth: 1,
                borderColor: disabled
                  ? withAlpha(c.onSurface, DISABLED_OPACITY.container)
                  : c.outlineVariant,
              }),
        },
        style as ViewStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          {!disabled ? (
            <StateLayer color={content} pressed={pressed} borderRadius={SHAPE.small} />
          ) : null}
          {leadingIcon ? <MaterialIcons name={leadingIcon} size={18} color={content} /> : null}
          <Text variant="labelLarge" style={{ color: content }} numberOfLines={1}>
            {label}
          </Text>
          {onClose ? (
            <View accessible accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
              <MaterialIcons name="close" size={18} color={content} onPress={onClose} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export interface ChipGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ChipGroup({ children, style }: ChipGroupProps) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style as ViewStyle]}>
      {children}
    </View>
  );
}
