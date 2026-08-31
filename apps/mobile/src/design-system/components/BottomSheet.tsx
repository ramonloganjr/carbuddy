import React, { useCallback, useEffect } from 'react';
import {
  BackHandler,
  Modal,
  Pressable as RNPressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { IconButton } from './IconButton';
import { SHAPE } from '../tokens/shape';
import { springConfig, timingConfig } from '../tokens/motion';
import { withAlpha } from '../tokens/colors';

export interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  /** Fraction of screen height the sheet occupies, 0–1. */
  heightRatio?: number;
  /** Disable the drag-to-dismiss gesture for destructive confirmations. */
  dismissable?: boolean;
  scrollable?: boolean;
  children: React.ReactNode;
  testID?: string;
}

const DISMISS_VELOCITY = 800;
const DISMISS_DISTANCE_RATIO = 0.4;

/**
 * Material 3 modal bottom sheet.
 *
 * The drag gesture runs entirely on the UI thread through Reanimated, so the
 * sheet tracks the finger even while the JS thread is busy rendering a long
 * list behind it — the difference between a sheet that feels attached to the
 * touch and one that stutters.
 *
 * Dismissal is decided by velocity *or* distance: a quick flick should close it
 * even if it barely moved, which is how the platform sheets behave and what
 * people's thumbs already expect.
 */
export function BottomSheet({
  visible,
  onDismiss,
  title,
  heightRatio = 0.75,
  dismissable = true,
  scrollable = true,
  children,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const sheetHeight = screenHeight * heightRatio;

  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springConfig('expressiveSpatial', theme.reduceMotion));
      backdropOpacity.value = withTiming(
        1,
        timingConfig('short4', 'emphasized', theme.reduceMotion),
      );
    } else {
      translateY.value = sheetHeight;
      backdropOpacity.value = 0;
    }
  }, [backdropOpacity, sheetHeight, theme.reduceMotion, translateY, visible]);

  const close = useCallback(() => {
    translateY.value = withSpring(sheetHeight, springConfig('fastSpatial', theme.reduceMotion));
    backdropOpacity.value = withTiming(0, timingConfig('short3', 'emphasized', theme.reduceMotion));
    onDismiss();
  }, [backdropOpacity, onDismiss, sheetHeight, theme.reduceMotion, translateY]);

  // Android hardware back must close the sheet, not the screen behind it.
  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissable) close();
      return true;
    });
    return () => subscription.remove();
  }, [close, dismissable, visible]);

  const dragGesture = Gesture.Pan()
    .enabled(dismissable)
    .onChange((event) => {
      // Downward only — dragging up must not detach the sheet from its stop.
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.velocityY > DISMISS_VELOCITY ||
        translateY.value > sheetHeight * DISMISS_DISTANCE_RATIO;
      if (shouldDismiss) {
        translateY.value = withSpring(sheetHeight, springConfig('fastSpatial', false));
        runOnJS(onDismiss)();
      } else {
        translateY.value = withSpring(0, springConfig('defaultSpatial', false));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const Content = scrollable ? ScrollView : View;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissable ? close : undefined}
      testID={testID}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[{ flex: 1, backgroundColor: withAlpha(theme.colors.scrim, 0.4) }, backdropStyle]}
        >
          <RNPressable
            style={{ flex: 1 }}
            onPress={dismissable ? close : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint="Dismisses this sheet"
          />
        </Animated.View>

        <GestureDetector gesture={dragGesture}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: sheetHeight,
                backgroundColor: theme.colors.surfaceContainerLow,
                borderTopLeftRadius: SHAPE.extraLarge,
                borderTopRightRadius: SHAPE.extraLarge,
                paddingBottom: insets.bottom,
              },
              sheetStyle,
            ]}
          >
            {dismissable ? (
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 32,
                    height: 4,
                    borderRadius: SHAPE.full,
                    backgroundColor: theme.colors.outlineVariant,
                  }}
                />
              </View>
            ) : null}

            {title ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 8,
                }}
              >
                <Text variant="headlineSmall" style={{ flex: 1 }} accessibilityRole="header">
                  {title}
                </Text>
                <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
              </View>
            ) : null}

            <Content
              style={{ flex: 1 }}
              {...(scrollable
                ? {
                    contentContainerStyle: { paddingHorizontal: 16, paddingBottom: 24 },
                    keyboardShouldPersistTaps: 'handled' as const,
                    showsVerticalScrollIndicator: false,
                  }
                : { style: { flex: 1, paddingHorizontal: 16 } })}
            >
              {children}
            </Content>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
