import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';

export interface ListItemProps {
  headline: string;
  supportingText?: string;
  overline?: string;
  /** Right-aligned value, e.g. a cost or a date. */
  trailingText?: string;
  trailingSupportingText?: string;
  leadingIcon?: keyof typeof MaterialIcons.glyphMap;
  leadingIconColor?: string;
  leadingIconBackground?: string;
  leadingContent?: React.ReactNode;
  trailingContent?: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  showChevron?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Material 3 list item, one, two or three lines.
 *
 * The composed `accessibilityLabel` is the important part: without it a screen
 * reader reads a row as four disconnected fragments ("Shell", "12 March",
 * "45.20 litres", "$68.40"). Joining them into one sentence turns a list into
 * something that can actually be navigated by ear.
 */
export function ListItem({
  headline,
  supportingText,
  overline,
  trailingText,
  trailingSupportingText,
  leadingIcon,
  leadingIconColor,
  leadingIconBackground,
  leadingContent,
  trailingContent,
  onPress,
  selected = false,
  showChevron = false,
  style,
  accessibilityLabel,
  testID,
}: ListItemProps) {
  const theme = useTheme();
  const c = theme.colors;

  const label =
    accessibilityLabel ??
    [overline, headline, supportingText, trailingText, trailingSupportingText]
      .filter(Boolean)
      .join(', ');

  const content = (
    <>
      {leadingContent ??
        (leadingIcon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: SHAPE.medium,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: leadingIconBackground ?? c.secondaryContainer,
            }}
          >
            <MaterialIcons
              name={leadingIcon}
              size={22}
              color={leadingIconColor ?? c.onSecondaryContainer}
            />
          </View>
        ) : null)}

      <View style={{ flex: 1, gap: 2 }}>
        {overline ? (
          <Text variant="labelSmall" color="onSurfaceVariant" numberOfLines={1}>
            {overline}
          </Text>
        ) : null}
        <Text variant="bodyLarge" numberOfLines={1}>
          {headline}
        </Text>
        {supportingText ? (
          <Text variant="bodyMedium" color="onSurfaceVariant" numberOfLines={2}>
            {supportingText}
          </Text>
        ) : null}
      </View>

      {trailingContent ??
        (trailingText ? (
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="numericSmall" numberOfLines={1}>
              {trailingText}
            </Text>
            {trailingSupportingText ? (
              <Text variant="bodySmall" color="onSurfaceVariant" numberOfLines={1}>
                {trailingSupportingText}
              </Text>
            ) : null}
          </View>
        ) : null)}

      {showChevron ? (
        <MaterialIcons name="chevron-right" size={24} color={c.onSurfaceVariant} />
      ) : null}
    </>
  );

  const layout: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
    borderRadius: SHAPE.medium,
  };

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        style={[layout, style as ViewStyle]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      shape="medium"
      haptic="light"
      scaleOnPress={0.99}
      ensureTouchTarget={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[layout, { minHeight: 56 }, style as ViewStyle]}
    >
      {({ pressed }) => (
        <>
          <StateLayer
            color={c.onSurface}
            pressed={pressed}
            selected={selected}
            borderRadius={SHAPE.medium}
          />
          {content}
        </>
      )}
    </Pressable>
  );
}

export function Divider({ inset = false, style }: { inset?: boolean; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height: 1,
          backgroundColor: theme.colors.outlineVariant,
          marginLeft: inset ? 72 : 0,
        },
        style as ViewStyle,
      ]}
    />
  );
}
