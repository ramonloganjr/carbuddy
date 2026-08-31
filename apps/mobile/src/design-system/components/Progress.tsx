import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';
import { springConfig } from '../tokens/motion';
import { statusColors, type SemanticStatus } from '../tokens/colors';

export interface LinearProgressProps {
  /** 0–1. Values above 1 are clamped but reported in the label. */
  progress: number;
  status?: SemanticStatus;
  height?: number;
  label?: string;
  /** Spoken description; falls back to a percentage. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Material 3 linear progress.
 *
 * Used for service-interval progress ("70% of the way to the next oil change"),
 * where the *gap* between the filled track and the end is the meaningful part.
 * The M3 Expressive track gap and rounded stop indicator are what make that
 * boundary readable at a glance.
 */
export function LinearProgress({
  progress,
  status = 'ok',
  height = 8,
  label,
  accessibilityLabel,
  style,
}: LinearProgressProps) {
  const theme = useTheme();
  const colors = statusColors(theme.colors, status);
  const clamped = Math.max(0, Math.min(progress, 1));
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = clamped;
  }, [clamped, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${withSpring(value.value * 100, springConfig('defaultSpatial', theme.reduceMotion))}%`,
  }));

  return (
    <View style={[{ gap: 6 }, style as ViewStyle]}>
      {label ? (
        <Text variant="labelMedium" color="onSurfaceVariant">
          {label}
        </Text>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel ?? `${Math.round(progress * 100)} percent`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        style={{
          height,
          borderRadius: SHAPE.full,
          backgroundColor: theme.colors.surfaceContainerHighest,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Animated.View
          style={[{ height, borderRadius: SHAPE.full, backgroundColor: colors.accent }, fillStyle]}
        />
      </View>
    </View>
  );
}

export interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  status?: SemanticStatus;
  /** Rendered in the middle — typically the score itself. */
  centerLabel?: string;
  centerSupportingText?: string;
  accessibilityLabel: string;
}

/**
 * Ring gauge used for the vehicle health score.
 *
 * The number is always printed in the centre as well as encoded in the arc, so
 * the value is readable without interpreting either the sweep or the colour.
 */
export function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 10,
  status = 'ok',
  centerLabel,
  centerSupportingText,
  accessibilityLabel,
}: CircularProgressProps) {
  const theme = useTheme();
  const colors = statusColors(theme.colors, status);
  const clamped = Math.max(0, Math.min(progress, 1));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceContainerHighest}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
          // Start the sweep at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={{ alignItems: 'center' }}>
        {centerLabel ? <Text variant="numericMedium">{centerLabel}</Text> : null}
        {centerSupportingText ? (
          <Text variant="labelSmall" color="onSurfaceVariant">
            {centerSupportingText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
