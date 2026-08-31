import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';

export type EmptyStateTone = 'neutral' | 'offline' | 'error' | 'success';

export interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  /** One or two sentences. Say what to do next, not just what is missing. */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tone?: EmptyStateTone;
  compact?: boolean;
  style?: ViewStyle;
}

/**
 * The shared empty / offline / error state.
 *
 * One component covers all three because they differ only in tone and copy, and
 * routing them through the same place is what stops a product from growing a
 * dozen subtly different "nothing here" screens. Every instance is required to
 * supply a description that tells the user what to do next — an empty screen
 * saying only "No records" is a dead end.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = 'neutral',
  compact = false,
  style,
}: EmptyStateProps) {
  const theme = useTheme();
  const c = theme.colors;

  const palette = {
    neutral: { bg: c.secondaryContainer, fg: c.onSecondaryContainer },
    offline: { bg: c.surfaceContainerHigh, fg: c.onSurfaceVariant },
    error: { bg: c.errorContainer, fg: c.onErrorContainer },
    success: { bg: c.successContainer, fg: c.onSuccessContainer },
  }[tone];

  const size = compact ? 56 : 88;

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingVertical: compact ? 24 : 48,
          gap: compact ? 12 : 16,
        },
        style as ViewStyle,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: size,
          height: size,
          borderRadius: SHAPE.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
        }}
      >
        <MaterialIcons name={icon} size={compact ? 28 : 40} color={palette.fg} />
      </View>

      <View style={{ gap: 6, alignItems: 'center' }}>
        <Text variant={compact ? 'titleMedium' : 'headlineSmall'} align="center">
          {title}
        </Text>
        <Text variant="bodyMedium" color="onSurfaceVariant" align="center">
          {description}
        </Text>
      </View>

      {actionLabel && onAction ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 4,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button label={actionLabel} onPress={onAction} variant="filled" />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="text" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Offline banner for the top of a screen — informative, never alarming. */
export function OfflineBanner({ pendingCount }: { pendingCount: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderRadius: SHAPE.medium,
      }}
    >
      <MaterialIcons name="cloud-off" size={18} color={theme.colors.onSurfaceVariant} />
      <Text variant="bodySmall" color="onSurfaceVariant" style={{ flex: 1 }}>
        {pendingCount > 0
          ? `Offline — ${pendingCount} change${pendingCount === 1 ? '' : 's'} saved here and will sync automatically.`
          : 'Offline — everything you have logged is still available.'}
      </Text>
    </View>
  );
}
