import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { IconButton } from './IconButton';

export interface TopAppBarAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  badge?: number;
}

export interface TopAppBarProps {
  title: string;
  subtitle?: string;
  /** `large` collapses to `small` on scroll — the M3 Expressive default. */
  variant?: 'small' | 'medium' | 'large' | 'centerAligned';
  onBack?: () => void;
  backLabel?: string;
  actions?: readonly TopAppBarAction[];
  /** Scroll offset in px, used to drive the collapse. */
  scrollY?: SharedValue<number>;
  style?: ViewStyle;
}

const COLLAPSE_DISTANCE = 96;

/**
 * Material 3 top app bar.
 *
 * The large variant collapses as the user scrolls: the oversized headline
 * shrinks away and reappears inline in the bar. This is the clearest expression
 * of the Expressive type scale — a screen opens with a genuinely large title
 * and trades it for content as soon as the user starts reading.
 *
 * The collapse is driven by a shared value on the UI thread, so it stays smooth
 * regardless of what the list below is doing.
 */
export function TopAppBar({
  title,
  subtitle,
  variant = 'small',
  onBack,
  backLabel = 'Go back',
  actions = [],
  scrollY,
  style,
}: TopAppBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isLarge = variant === 'large' || variant === 'medium';

  const largeTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1, transform: [{ translateY: 0 }] };
    const progress = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [1, 0], 'clamp');
    return {
      opacity: progress,
      transform: [{ translateY: interpolate(progress, [0, 1], [-12, 0]) }],
    };
  });

  const inlineTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: isLarge ? 0 : 1 };
    const progress = interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * 0.6, COLLAPSE_DISTANCE],
      [0, 1],
      'clamp',
    );
    return { opacity: isLarge ? progress : 1 };
  });

  const surfaceStyle = useAnimatedStyle(() => {
    if (!scrollY) return { backgroundColor: theme.colors.surface };
    // Tonal lift on scroll rather than a shadow — the M3 way of showing that
    // content has passed beneath the bar.
    const progress = interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [0, 1], 'clamp');
    return {
      backgroundColor: progress > 0.5 ? theme.colors.surfaceContainer : theme.colors.surface,
    };
  });

  return (
    <Animated.View style={[{ paddingTop: insets.top }, surfaceStyle, style as ViewStyle]}>
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 4,
          gap: 4,
        }}
      >
        {onBack ? (
          <IconButton icon="arrow-back" accessibilityLabel={backLabel} onPress={onBack} />
        ) : (
          <View style={{ width: variant === 'centerAligned' ? 48 : 12 }} />
        )}

        <Animated.View
          style={[
            { flex: 1 },
            inlineTitleStyle,
            variant === 'centerAligned' ? { alignItems: 'center' } : null,
          ]}
        >
          <Text
            variant="titleLarge"
            numberOfLines={1}
            accessibilityRole="header"
            // The large headline below carries the heading role while expanded;
            // this inline copy is decorative until the bar has collapsed.
            accessibilityElementsHidden={isLarge}
          >
            {title}
          </Text>
        </Animated.View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {actions.map((action) => (
            <View key={action.accessibilityLabel}>
              <IconButton
                icon={action.icon}
                accessibilityLabel={
                  action.badge
                    ? `${action.accessibilityLabel}, ${action.badge} new`
                    : action.accessibilityLabel
                }
                onPress={action.onPress}
              />
              {action.badge ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.error,
                  }}
                >
                  <Text variant="labelSmall" style={{ color: theme.colors.onError, fontSize: 10 }}>
                    {action.badge > 9 ? '9+' : action.badge}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
          {variant === 'centerAligned' && actions.length === 0 ? (
            <View style={{ width: 48 }} />
          ) : null}
        </View>
      </View>

      {isLarge ? (
        <Animated.View
          style={[{ paddingHorizontal: 16, paddingBottom: 20, gap: 2 }, largeTitleStyle]}
        >
          <Text
            variant={variant === 'large' ? 'displaySmall' : 'headlineMedium'}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyMedium" color="onSurfaceVariant">
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
