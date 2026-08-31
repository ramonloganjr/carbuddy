import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';
import { SHAPE } from '../tokens/shape';
import { elevation } from '../tokens/elevation';
import { springConfig, timingConfig } from '../tokens/motion';

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  tone?: 'default' | 'error' | 'success';
}

interface SnackbarContextValue {
  show: (options: SnackbarOptions) => void;
  dismiss: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

/**
 * App-wide snackbar host.
 *
 * The `onAction` slot is what makes destructive actions in this app safe: a
 * deleted fuel record is removed optimistically and the snackbar offers Undo,
 * which is friendlier and faster than a confirmation dialog on every swipe.
 */
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<SnackbarOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const show = useCallback((options: SnackbarOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(options);
    // Material's guidance: longer when there is an action to react to.
    const duration = options.durationMs ?? (options.actionLabel ? 8000 : 4000);
    timer.current = setTimeout(() => setCurrent(null), duration);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show, dismiss }), [dismiss, show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? <SnackbarHost options={current} onDismiss={dismiss} /> : null}
    </SnackbarContext.Provider>
  );
}

function SnackbarHost({ options, onDismiss }: { options: SnackbarOptions; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const entry = useSharedValue(0);

  useEffect(() => {
    entry.value = 1;
  }, [entry]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(entry.value, timingConfig('short4', 'emphasized', theme.reduceMotion)),
    transform: [
      {
        translateY: theme.reduceMotion
          ? 0
          : withSpring((1 - entry.value) * 60, springConfig('defaultSpatial', theme.reduceMotion)),
      },
    ],
  }));

  const background =
    options.tone === 'error'
      ? theme.colors.errorContainer
      : options.tone === 'success'
        ? theme.colors.successContainer
        : theme.colors.inverseSurface;

  const foreground =
    options.tone === 'error'
      ? theme.colors.onErrorContainer
      : options.tone === 'success'
        ? theme.colors.onSuccessContainer
        : theme.colors.inverseOnSurface;

  return (
    <Animated.View
      // `assertive` so it interrupts — a snackbar with an Undo action is
      // time-limited, and a polite announcement can arrive after it is gone.
      accessibilityLiveRegion="assertive"
      style={[
        {
          position: 'absolute',
          left: 16,
          right: 16,
          // Sits above the navigation bar, not under it.
          bottom: insets.bottom + 88,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 48,
          paddingLeft: 16,
          paddingRight: options.actionLabel ? 8 : 16,
          paddingVertical: 8,
          borderRadius: SHAPE.extraSmall,
          backgroundColor: background,
        },
        elevation(3, theme.colors.shadow),
        animatedStyle,
      ]}
    >
      <Text variant="bodyMedium" style={{ flex: 1, color: foreground }}>
        {options.message}
      </Text>
      {options.actionLabel ? (
        <Button
          label={options.actionLabel}
          variant="text"
          size="small"
          haptic="light"
          contentColor={options.tone === 'default' ? theme.colors.inversePrimary : foreground}
          onPress={() => {
            options.onAction?.();
            onDismiss();
          }}
          style={{ marginVertical: -4 }}
        />
      ) : null}
    </Animated.View>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used inside a <SnackbarProvider>.');
  return context;
}
