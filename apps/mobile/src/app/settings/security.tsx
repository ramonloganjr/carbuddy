import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { describeSyncStatus } from '@carbuddy/domain';
import {
  Button,
  Card,
  Dialog,
  ListItem,
  Switch,
  Text,
  useSnackbar,
  useTheme,
} from '../../design-system';
import { SettingsScreen, SettingsSection } from '../../features/settings/SettingsScreen';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useSession } from '../../features/auth/sessionStore';
import { useSync } from '../../features/sync/syncStore';
import { authenticate, getBiometricCapability } from '../../lib/biometrics';

export default function SecuritySettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const snackbar = useSnackbar();

  const preferences = usePreferences((state) => state.preferences);
  const update = usePreferences((state) => state.update);
  const email = useSession((state) => state.email);
  const signOut = useSession((state) => state.signOut);
  const syncStatus = useSync((state) => state.status);
  const syncNow = useSync((state) => state.syncNow);

  const [capability, setCapability] = useState({
    available: false,
    enrolled: false,
    label: 'Face ID',
  });
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    void getBiometricCapability().then(setCapability);
  }, []);

  if (!preferences) return <SettingsScreen title="Privacy and security">{null}</SettingsScreen>;

  /**
   * Require a successful unlock before *enabling* the lock.
   *
   * Without this a user could switch it on while biometrics are misconfigured
   * and lock themselves out of their own records on the next launch.
   */
  const toggleLock = async (enabled: boolean) => {
    if (!enabled) {
      await update({ biometricLockEnabled: false });
      return;
    }

    const result = await authenticate(`Confirm with ${capability.label}`);
    if (result === 'success') {
      await update({ biometricLockEnabled: true });
      snackbar.show({ message: 'App lock is on.', tone: 'success' });
    } else if (result === 'unavailable') {
      snackbar.show({
        message: `Set up ${capability.label} in your device settings first.`,
        tone: 'error',
      });
    }
  };

  return (
    <SettingsScreen title="Privacy and security">
      <SettingsSection title="Account">
        <Card variant="filled" padding={4}>
          <ListItem
            headline={email ?? 'Signed in'}
            supportingText="Your account"
            leadingIcon="person"
          />
        </Card>
      </SettingsSection>

      <SettingsSection title="App lock">
        <Card variant="filled" padding={0}>
          <Switch
            value={preferences.biometricLockEnabled}
            onValueChange={(enabled) => void toggleLock(enabled)}
            label={`Unlock with ${capability.label}`}
            supportingText={
              capability.enrolled
                ? 'Required after the app has been in the background for a minute'
                : `Set up ${capability.label} on this device first`
            }
            disabled={!capability.available || !capability.enrolled}
          />
        </Card>
      </SettingsSection>

      <SettingsSection title="Your data">
        <Card variant="filled" padding={4}>
          <ListItem
            headline="Sync status"
            supportingText={describeSyncStatus(syncStatus)}
            leadingIcon={syncStatus.state === 'offline' ? 'cloud-off' : 'cloud-done'}
            onPress={() => void syncNow()}
          />
        </Card>

        <Card variant="outlined">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MaterialIcons name="lock" size={20} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" color="onSurfaceVariant" style={{ flex: 1 }}>
              Your sign-in tokens are held in the device keychain, never in ordinary app storage.
              VINs and document numbers are encrypted before they leave the device, and files are
              transferred through short-lived signed links.
            </Text>
          </View>
        </Card>
      </SettingsSection>

      <SettingsSection title="Session">
        <Button
          label="Sign out"
          variant="outlined"
          icon="logout"
          fullWidth
          onPress={() => setConfirmSignOut(true)}
        />
      </SettingsSection>

      <Dialog
        visible={confirmSignOut}
        onDismiss={() => setConfirmSignOut(false)}
        title="Sign out of CarBuddy?"
        description={
          syncStatus.pendingCount > 0
            ? `You have ${syncStatus.pendingCount} change${syncStatus.pendingCount === 1 ? '' : 's'} that have not synced yet. Signing out now will discard them.`
            : 'Your records stay safe in your account. This device will be cleared.'
        }
        icon="logout"
        destructive={syncStatus.pendingCount > 0}
        confirmLabel="Sign out"
        onConfirm={() => {
          void signOut().then(() => router.replace('/(auth)/sign-in'));
        }}
      />
    </SettingsScreen>
  );
}
