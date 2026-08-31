import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { StateLayer } from './StateLayer';
import { Text } from './Text';
import { SHAPE } from '../tokens/shape';
import { elevation } from '../tokens/elevation';
import { springConfig, timingConfig } from '../tokens/motion';

export type FABSize = 'small' | 'medium' | 'large';
export type FABColor = 'primary' | 'secondary' | 'tertiary' | 'surface';

export interface FABProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  /** Present the FAB as an extended FAB carrying this label. */
  label?: string;
  size?: FABSize;
  color?: FABColor;
  /** Collapse an extended FAB to icon-only, e.g. while a list scrolls down. */
  extended?: boolean;
  visible?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const SIZES: Record<FABSize, { size: number; icon: number; radius: number }> = {
  small: { size: 40, icon: 24, radius: SHAPE.medium },
  medium: { size: 56, icon: 24, radius: SHAPE.large },
  large: { size: 96, icon: 36, radius: SHAPE.extraLarge },
};

/**
 * The Material 3 Expressive floating action button.
 *
 * Two Expressive behaviours are built in:
 *   - The extended FAB **collapses to an icon while the user scrolls down** and
 *     re-expands at rest, so it stops covering content without ever leaving.
 *   - Entry and exit use the pronounced `expressiveSpatial` spring, because the
 *     FAB is the screen's primary action and is meant to arrive with presence.
 *
 * Both are suppressed under reduce-motion, where the FAB simply fades.
 */
export function FAB({
  icon,
  onPress,
  accessibilityLabel,
  label,
  size = 'medium',
  color = 'primary',
  extended = true,
  visible = true,
  style,
  testID,
}: FABProps) {
  const theme = useTheme();
  const dimensions = SIZES[size];
  const appearance = useSharedValue(visible ? 1 : 0);
  const expansion = useSharedValue(label && extended ? 1 : 0);

  useEffect(() => {
    appearance.value = visible ? 1 : 0;
  }, [appearance, visible]);

  useEffect(() => {
    expansion.value = label && extended ? 1 : 0;
  }, [expansion, extended, label]);

  const palette = (() => {
    const c = theme.colors;
    switch (color) {
      case 'secondary':
        return { container: c.secondaryContainer, content: c.onSecondaryContainer };
      case 'tertiary':
        return { container: c.tertiaryContainer, content: c.onTertiaryContainer };
      case 'surface':
        return { container: c.surfaceContainerHigh, content: c.primary };
      case 'primary':
      default:
        return { container: c.primaryContainer, content: c.onPrimaryContainer };
    }
  })();

  const containerStyle = useAnimatedStyle(() => {
    const spatial = springConfig('expressiveSpatial', theme.reduceMotion);
    return {
      opacity: withTiming(
        appearance.value,
        timingConfig('short4', 'emphasized', theme.reduceMotion),
      ),
      transform: [
        { scale: theme.reduceMotion ? 1 : withSpring(0.6 + appearance.value * 0.4, spatial) },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(expansion.value, timingConfig('short3', 'emphasized', theme.reduceMotion)),
    maxWidth: withSpring(expansion.value * 200, springConfig('defaultSpatial', theme.reduceMotion)),
    marginLeft: withSpring(
      expansion.value * 12,
      springConfig('defaultSpatial', theme.reduceMotion),
    ),
  }));

  return (
    <Animated.View
      style={[
        containerStyle,
        elevation(3, theme.colors.shadow),
        { borderRadius: dimensions.radius, alignSelf: 'flex-start' },
        style as ViewStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onPress}
        haptic="medium"
        shape={size === 'large' ? 'extraLarge' : size === 'small' ? 'medium' : 'large'}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={{
          minHeight: dimensions.size,
          height: dimensions.size,
          minWidth: dimensions.size,
          paddingHorizontal: label ? 20 : 0,
          borderRadius: dimensions.radius,
          backgroundColor: palette.container,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {({ pressed }) => (
          <>
            <StateLayer
              color={palette.content}
              pressed={pressed}
              borderRadius={dimensions.radius}
            />
            <MaterialIcons name={icon} size={dimensions.icon} color={palette.content} />
            {label ? (
              <Animated.View style={labelStyle}>
                <Text
                  variant="labelLargeEmphasized"
                  numberOfLines={1}
                  style={{ color: palette.content }}
                >
                  {label}
                </Text>
              </Animated.View>
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export interface FABMenuAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}

export interface FABMenuProps {
  open: boolean;
  actions: readonly FABMenuAction[];
  onDismiss: () => void;
}

/**
 * The speed-dial that fans out of the main FAB.
 *
 * This is how "add fuel / expense / service / document / odometer / reminder"
 * all stay one tap from anywhere without six competing buttons on screen.
 * Items stagger in, which reads as a single object unfolding rather than six
 * things appearing at once.
 */
export function FABMenu({ open, actions, onDismiss }: FABMenuProps) {
  const theme = useTheme();

  if (!open) return null;

  return (
    <View style={{ alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
      {actions.map((action, index) => (
        <FABMenuItem
          key={action.label}
          action={action}
          index={index}
          total={actions.length}
          onDismiss={onDismiss}
          reduceMotion={theme.reduceMotion}
        />
      ))}
    </View>
  );
}

function FABMenuItem({
  action,
  index,
  total,
  onDismiss,
  reduceMotion,
}: {
  action: FABMenuAction;
  index: number;
  total: number;
  onDismiss: () => void;
  reduceMotion: boolean;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Items closest to the FAB lead, so the group reads as unfolding upward.
    const delay = reduceMotion ? 0 : (total - index - 1) * 35;
    const timer = setTimeout(() => {
      progress.value = 1;
    }, delay);
    return () => clearTimeout(timer);
  }, [index, progress, reduceMotion, total]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(progress.value, timingConfig('short3', 'emphasized', reduceMotion)),
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : withSpring((1 - progress.value) * 16, springConfig('defaultSpatial', reduceMotion)),
      },
      {
        scale: reduceMotion
          ? 1
          : withSpring(
              0.85 + progress.value * 0.15,
              springConfig('expressiveSpatial', reduceMotion),
            ),
      },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: SHAPE.small,
          backgroundColor: theme.colors.inverseSurface,
        }}
      >
        <Text variant="labelMedium" style={{ color: theme.colors.inverseOnSurface }}>
          {action.label}
        </Text>
      </View>
      <FAB
        icon={action.icon}
        size="small"
        color="surface"
        accessibilityLabel={action.label}
        onPress={() => {
          action.onPress();
          onDismiss();
        }}
      />
    </Animated.View>
  );
}
