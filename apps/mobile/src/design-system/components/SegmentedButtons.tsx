import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export interface SegmentedButtonsProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced before the group, e.g. "Time range". */
  accessibilityLabel: string;
  style?: ViewStyle;
}

/**
 * Material 3 segmented buttons — used across the app for range switching
 * (month / year / all) and unit toggles.
 *
 * The selected segment shows a check icon in addition to its filled background,
 * so the choice is legible without relying on colour perception.
 */
export function SegmentedButtons<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedButtonsProps<T>) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          borderRadius: SHAPE.full,
          borderWidth: 1,
          borderColor: c.outline,
          overflow: 'hidden',
        },
        style as ViewStyle,
      ]}
    >
      {segments.map((segment, index) => {
        const selected = segment.value === value;
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;

        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            haptic="selection"
            shape="none"
            ensureTouchTarget={false}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              height: 40,
              minHeight: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: selected ? c.secondaryContainer : 'transparent',
              borderLeftWidth: isFirst ? 0 : 1,
              borderLeftColor: c.outline,
              borderTopLeftRadius: isFirst ? SHAPE.full : 0,
              borderBottomLeftRadius: isFirst ? SHAPE.full : 0,
              borderTopRightRadius: isLast ? SHAPE.full : 0,
              borderBottomRightRadius: isLast ? SHAPE.full : 0,
            }}
          >
            {({ pressed }) => (
              <>
                <StateLayer
                  color={selected ? c.onSecondaryContainer : c.onSurface}
                  pressed={pressed}
                />
                {selected ? (
                  <MaterialIcons name="check" size={16} color={c.onSecondaryContainer} />
                ) : segment.icon ? (
                  <MaterialIcons name={segment.icon} size={16} color={c.onSurface} />
                ) : null}
                <Text
                  variant="labelLarge"
                  numberOfLines={1}
                  style={{ color: selected ? c.onSecondaryContainer : c.onSurface }}
                >
                  {segment.label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
