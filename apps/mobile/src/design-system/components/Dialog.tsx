import React from 'react';
import { Modal, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';
import { SHAPE } from '../tokens/shape';
import { elevation } from '../tokens/elevation';
import { withAlpha } from '../tokens/colors';

export interface DialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  description?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  /** Renders the confirm action in the error colour. */
  destructive?: boolean;
  children?: React.ReactNode;
  testID?: string;
}

/**
 * Material 3 basic dialog.
 *
 * Reserved for genuinely irreversible choices — deleting a vehicle takes its
 * whole history with it, so that one earns a dialog. Everything reversible uses
 * an optimistic update plus an Undo snackbar instead, which interrupts far less.
 */
export function Dialog({
  visible,
  onDismiss,
  title,
  description,
  icon,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
  destructive = false,
  children,
  testID,
}: DialogProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: withAlpha(theme.colors.scrim, 0.4),
        }}
      >
        <Animated.View
          entering={theme.reduceMotion ? FadeIn.duration(120) : ZoomIn.springify().damping(18)}
          accessibilityViewIsModal
          testID={testID}
          style={[
            {
              width: '100%',
              maxWidth: 400,
              padding: 24,
              gap: 16,
              borderRadius: SHAPE.extraLarge,
              backgroundColor: theme.colors.surfaceContainerHigh,
            },
            elevation(3, theme.colors.shadow),
          ]}
        >
          {icon ? (
            <View style={{ alignItems: 'center' }}>
              <MaterialIcons
                name={icon}
                size={24}
                color={destructive ? theme.colors.error : theme.colors.secondary}
              />
            </View>
          ) : null}

          <Text variant="headlineSmall" align={icon ? 'center' : 'left'} accessibilityRole="header">
            {title}
          </Text>

          {description ? (
            <Text variant="bodyMedium" color="onSurfaceVariant" align={icon ? 'center' : 'left'}>
              {description}
            </Text>
          ) : null}

          {children}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button label={cancelLabel} variant="text" onPress={onDismiss} />
            {confirmLabel && onConfirm ? (
              <Button
                label={confirmLabel}
                variant={destructive ? 'danger' : 'filled'}
                haptic={destructive ? 'warning' : 'medium'}
                onPress={() => {
                  onConfirm();
                  onDismiss();
                }}
              />
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
