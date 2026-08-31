import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, Text, useTheme } from '../../design-system';
import { requestNotificationPermission } from '../../lib/notifications';
import { usePreferences } from '../../features/settings/preferencesStore';

/**
 * The notification permission step.
 *
 * The OS prompt is shown only *after* this screen has said exactly what the app
 * will send. That ordering is the whole point: the system dialog can be shown
 * once, and a user who declines it cold can never be asked again from inside
 * the app. Spending that single attempt on an unexplained prompt permanently
 * breaks the reminder feature — which is one of the two reasons people install
 * something like this.
 *
 * Declining is a first-class outcome here, not a dead end. The app keeps
 * working; the reminders simply live inside it.
 */
const EXAMPLES = [
  {
    icon: 'build' as const,
    text: '"Oil change due in 2 weeks — or 400 km, whichever comes first."',
  },
  { icon: 'description' as const, text: '"Your insurance expires in 30 days."' },
  { icon: 'local-gas-station' as const, text: '"Fuel economy is down about 18% this month."' },
];

export default function OnboardingNotifications() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const update = usePreferences((state) => state.update);
  const preferences = usePreferences((state) => state.preferences);

  const [requesting, setRequesting] = useState(false);

  const finish = async (notificationsEnabled: boolean) => {
    if (preferences) {
      await update({
        notifications: { ...preferences.notifications, enabled: notificationsEnabled },
      });
    }
    router.push('/(onboarding)/vehicle');
  };

  const handleEnable = async () => {
    setRequesting(true);
    const state = await requestNotificationPermission();
    setRequesting(false);
    await finish(state === 'granted');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, gap: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primaryContainer,
          }}
        >
          <MaterialIcons
            name="notifications-active"
            size={36}
            color={theme.colors.onPrimaryContainer}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="headlineLargeEmphasized" accessibilityRole="header">
            Never miss a deadline
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            CarBuddy can remind you before something is due — not after. Here is the kind of thing
            you would get:
          </Text>
        </View>

        <Card variant="filled">
          <View style={{ gap: 16 }}>
            {EXAMPLES.map((example) => (
              <View
                key={example.text}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
              >
                <MaterialIcons
                  name={example.icon}
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodyMedium" style={{ flex: 1 }}>
                  {example.text}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Text variant="bodySmall" color="onSurfaceVariant">
          At most a few a day, and you choose which kinds. You can change this any time in Settings.
        </Text>
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 8 }}>
        <Button
          label="Turn on reminders"
          size="large"
          fullWidth
          loading={requesting}
          onPress={handleEnable}
        />
        <Button label="Not now" variant="text" fullWidth onPress={() => void finish(false)} />
      </View>
    </View>
  );
}
