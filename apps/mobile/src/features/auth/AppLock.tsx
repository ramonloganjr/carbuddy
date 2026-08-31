import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, type AppStateStatus } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Text, useTheme } from '../../design-system';
import { authenticate, getBiometricCapability } from '../../lib/biometrics';
import { usePreferences } from '../settings/preferencesStore';
import { useSession } from './sessionStore';

/**
 * Biometric app lock.
 *
 * Re-locks when the app has been in the background past a grace period rather
 * than on every backgrounding. Without the grace window, switching to the
 * camera to photograph a receipt — a core flow in this app — would demand a
 * Face ID prompt on the way back, every single time.
 */
const GRACE_PERIOD_MS = 60_000;

export function AppLock({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const enabled = usePreferences((state) => state.preferences?.biometricLockEnabled ?? false);
  const status = useSession((state) => state.status);
  const locked = useSession((state) => state.locked);
  const setLocked = useSession((state) => state.setLocked);

  const [prompting, setPrompting] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void getBiometricCapability().then((capability) => setLabel(capability.label));
  }, []);

  const unlock = useCallback(async () => {
    setPrompting(true);
    const result = await authenticate('Unlock CarBuddy');
    setPrompting(false);
    // `unavailable` means biometrics were removed or never enrolled — locking
    // the user out of their own records over that would be indefensible.
    if (result === 'success' || result === 'unavailable') setLocked(false);
  }, [setLocked]);

  useEffect(() => {
    if (!enabled || status !== 'authenticated') return undefined;

    const handleChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > GRACE_PERIOD_MS) setLocked(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [enabled, setLocked, status]);

  // Lock immediately when the setting is switched on.
  useEffect(() => {
    if (enabled && status === 'authenticated') setLocked(true);
  }, [enabled, setLocked, status]);

  // Only auto-prompt on the transition *into* the locked state. Re-running this
  // when `prompting` or `unlock` change would re-prompt immediately after the
  // user cancels, trapping them in a dialog they cannot dismiss.
  useEffect(() => {
    if (locked && !prompting) void unlock();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !locked || status !== 'authenticated') return <>{children}</>;

  return (
    <View
      accessibilityViewIsModal
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 32,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primaryContainer,
        }}
      >
        <MaterialIcons name="lock" size={40} color={theme.colors.onPrimaryContainer} />
      </View>

      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text variant="headlineSmall" align="center">
          CarBuddy is locked
        </Text>
        <Text variant="bodyMedium" color="onSurfaceVariant" align="center">
          Unlock with {label} to see your vehicles, documents and spending.
        </Text>
      </View>

      <Button
        label={`Unlock with ${label}`}
        icon="fingerprint"
        onPress={unlock}
        loading={prompting}
      />
    </View>
  );
}
