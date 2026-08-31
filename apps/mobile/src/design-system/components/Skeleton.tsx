import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { SHAPE } from '../tokens/shape';
import { DURATION, EASING } from '../tokens/motion';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Loading placeholder.
 *
 * Skeletons are shaped like the content they stand in for, so the layout does
 * not jump when real data arrives — that shift is the main thing a spinner gets
 * wrong. Under reduce-motion the shimmer is dropped and a static block is shown
 * instead; the whole group is hidden from screen readers, which get a single
 * "Loading" announcement from `SkeletonGroup` rather than a dozen empty nodes.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = SHAPE.small,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (theme.reduceMotion) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DURATION.extraLong2, easing: EASING.standard }),
        withTiming(0.5, { duration: DURATION.extraLong2, easing: EASING.standard }),
      ),
      -1,
      true,
    );
  }, [pulse, theme.reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceContainerHighest,
        },
        animatedStyle,
        style as ViewStyle,
      ]}
    />
  );
}

export function SkeletonGroup({
  children,
  label = 'Loading',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar">
      {children}
    </View>
  );
}

/** Skeleton shaped like a dashboard summary card. */
export function CardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderRadius: SHAPE.extraLarge,
        backgroundColor: theme.colors.surfaceContainer,
      }}
    >
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={32} />
      <Skeleton width="55%" height={12} />
    </View>
  );
}

/** Skeleton shaped like a fuel or expense row. */
export function ListItemSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Skeleton width={40} height={40} radius={SHAPE.medium} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={64} height={16} />
    </View>
  );
}
