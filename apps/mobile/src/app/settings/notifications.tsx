import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ReminderKind } from '@carbuddy/domain';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from '../../design-system';
import { SettingsScreen, SettingsSection } from '../../features/settings/SettingsScreen';
import { usePreferences } from '../../features/settings/preferencesStore';
import { getPermissionState, requestNotificationPermission } from '../../lib/notifications';

const KINDS: { value: ReminderKind; label: string }[] = [
  { value: 'maintenance_due', label: 'Service due' },
  { value: 'maintenance_overdue', label: 'Service overdue' },
  { value: 'document_expiry', label: 'Documents' },
  { value: 'component_replacement', label: 'Wear items' },
  { value: 'tyre_rotation', label: 'Tyre rotation' },
  { value: 'fuel_anomaly', label: 'Fuel insights' },
  { value: 'custom', label: 'My reminders' },
];

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const preferences = usePreferences((state) => state.preferences);
  const update = usePreferences((state) => state.update);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );

  useEffect(() => {
    void getPermissionState().then(setPermission);
  }, []);

  if (!preferences) return <SettingsScreen title="Notifications">{null}</SettingsScreen>;

  const notifications = preferences.notifications;
  const muted = new Set(notifications.mutedKinds ?? []);

  const setNotifications = (patch: Partial<typeof notifications>) =>
    void update({ notifications: { ...notifications, ...patch } });

  const toggleKind = (kind: ReminderKind) => {
    const next = new Set(muted);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setNotifications({ mutedKinds: [...next] });
  };

  return (
    <SettingsScreen
      title="Notifications"
      description="CarBuddy reminds you before something is due, not after."
    >
      {/* The OS permission cannot be re-prompted once denied, so the only
          honest thing to offer at that point is a route to Settings. */}
      {permission !== 'granted' ? (
        <Card variant="filled" background={theme.colors.warningContainer}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MaterialIcons
                name="notifications-off"
                size={20}
                color={theme.colors.onWarningContainer}
              />
              <Text
                variant="bodyMedium"
                style={{ flex: 1, color: theme.colors.onWarningContainer }}
              >
                {permission === 'denied'
                  ? 'Notifications are turned off for CarBuddy. Reminders still appear inside the app, but nothing will reach your lock screen until you enable them in your device settings.'
                  : 'Turn on notifications so reminders reach you even when the app is closed.'}
              </Text>
            </View>
            {permission === 'undetermined' ? (
              <Button
                label="Turn on notifications"
                variant="tonal"
                onPress={() => void requestNotificationPermission().then(setPermission)}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card variant="filled" padding={0}>
        <Switch
          value={notifications.enabled}
          onValueChange={(enabled) => setNotifications({ enabled })}
          label="Reminders"
          supportingText="Turn everything off without losing your settings"
        />
      </Card>

      <SettingsSection title="What to send">
        <ChipGroup>
          {KINDS.map((kind) => (
            <Chip
              key={kind.value}
              label={kind.label}
              variant="filter"
              selected={!muted.has(kind.value)}
              disabled={!notifications.enabled}
              onPress={() => toggleKind(kind.value)}
            />
          ))}
        </ChipGroup>
      </SettingsSection>

      <SettingsSection title="When to send">
        <View style={{ gap: 12 }}>
          <Text variant="bodyMedium" color="onSurfaceVariant" style={{ paddingHorizontal: 4 }}>
            Reminders are delivered at this hour, your local time.
          </Text>
          <SegmentedButtons
            segments={[
              { value: '7', label: '7am' },
              { value: '9', label: '9am' },
              { value: '12', label: 'Noon' },
              { value: '18', label: '6pm' },
            ]}
            value={String(notifications.preferredHour)}
            onChange={(value) => setNotifications({ preferredHour: Number(value) })}
            accessibilityLabel="Delivery time"
          />
        </View>
      </SettingsSection>

      <SettingsSection title="Daily limit">
        <View style={{ gap: 12 }}>
          <Text variant="bodyMedium" color="onSurfaceVariant" style={{ paddingHorizontal: 4 }}>
            A hard cap, so a neglected garage cannot produce a wall of alerts. The most urgent
            reminders are kept.
          </Text>
          <SegmentedButtons
            segments={[
              { value: '1', label: '1' },
              { value: '3', label: '3' },
              { value: '5', label: '5' },
              { value: '10', label: '10' },
            ]}
            value={String(notifications.maxPerDay)}
            onChange={(value) => setNotifications({ maxPerDay: Number(value) })}
            accessibilityLabel="Maximum notifications per day"
          />
        </View>
      </SettingsSection>

      <Card variant="filled" padding={0}>
        <Switch
          value={Boolean(notifications.quietHours)}
          onValueChange={(enabled) =>
            setNotifications({ quietHours: enabled ? { start: 22, end: 7 } : undefined })
          }
          label="Quiet hours"
          supportingText="Hold reminders between 10pm and 7am"
        />
      </Card>
    </SettingsScreen>
  );
}
