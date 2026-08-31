import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';
import { statusColors, type SemanticStatus } from '../tokens/colors';

export interface StatusPillProps {
  status: SemanticStatus;
  label: string;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

/**
 * Icon + colour + text, always together.
 *
 * This component exists specifically to enforce the "never rely on colour
 * alone" rule (WCAG 1.4.1). Status in this app is genuinely consequential — an
 * overdue brake service, an expired insurance policy — so the distinction has
 * to survive colour blindness, a greyscale screenshot, and a phone in bright
 * sunlight. Every status in the product renders through here rather than as an
 * ad-hoc coloured dot.
 */
const STATUS_ICON: Record<SemanticStatus, keyof typeof MaterialIcons.glyphMap> = {
  ok: 'check-circle',
  due_soon: 'schedule',
  due: 'error',
  overdue: 'warning',
  unknown: 'help-outline',
};

/** Spoken text, so a screen reader hears the meaning and not just the label. */
const STATUS_DESCRIPTION: Record<SemanticStatus, string> = {
  ok: 'Up to date',
  due_soon: 'Due soon',
  due: 'Due now',
  overdue: 'Overdue',
  unknown: 'Not tracked',
};

export function StatusPill({ status, label, size = 'medium', style }: StatusPillProps) {
  const theme = useTheme();
  const colors = statusColors(theme.colors, status);
  const compact = size === 'small';

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${STATUS_DESCRIPTION[status]}. ${label}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? 4 : 6,
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 6,
          borderRadius: SHAPE.small,
          backgroundColor: colors.container,
          alignSelf: 'flex-start',
        },
        style as ViewStyle,
      ]}
    >
      <MaterialIcons
        name={STATUS_ICON[status]}
        size={compact ? 14 : 16}
        color={colors.onContainer}
      />
      <Text
        variant={compact ? 'labelSmall' : 'labelMedium'}
        style={{ color: colors.onContainer }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export interface TrendIndicatorProps {
  /** Positive always means "better", whatever the underlying metric. */
  changePercent: number | null;
  direction: 'improving' | 'declining' | 'steady' | 'unknown';
  size?: 'small' | 'medium';
}

/**
 * Trend arrow for fuel economy and spending.
 *
 * Takes a pre-computed direction rather than deriving one from the sign of the
 * number, because "up" is good for km/L and bad for L/100 km. The domain layer
 * settles that question once; this component only renders the verdict.
 */
export function TrendIndicator({ changePercent, direction, size = 'medium' }: TrendIndicatorProps) {
  const theme = useTheme();
  const compact = size === 'small';

  if (direction === 'unknown' || changePercent === null) {
    return (
      <Text variant={compact ? 'labelSmall' : 'labelMedium'} color="onSurfaceVariant">
        Not enough data yet
      </Text>
    );
  }

  const icon: keyof typeof MaterialIcons.glyphMap =
    direction === 'improving'
      ? 'trending-up'
      : direction === 'declining'
        ? 'trending-down'
        : 'trending-flat';

  const color =
    direction === 'improving'
      ? theme.colors.success
      : direction === 'declining'
        ? theme.colors.error
        : theme.colors.onSurfaceVariant;

  const spoken =
    direction === 'improving'
      ? `Improved by ${Math.abs(Math.round(changePercent))} percent`
      : direction === 'declining'
        ? `Declined by ${Math.abs(Math.round(changePercent))} percent`
        : 'Holding steady';

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <MaterialIcons name={icon} size={compact ? 14 : 18} color={color} />
      <Text variant={compact ? 'labelSmall' : 'labelMedium'} style={{ color }}>
        {direction === 'steady' ? 'Steady' : `${Math.abs(Math.round(changePercent))}%`}
      </Text>
    </View>
  );
}
