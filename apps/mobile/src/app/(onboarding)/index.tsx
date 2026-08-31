import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Text, useTheme } from '../../design-system';

/**
 * The welcome step.
 *
 * One screen, three promises, one button. Long onboarding carousels are where
 * people bounce; the fastest route to value here is getting a car into the app,
 * so everything else waits until they have one.
 */
const VALUE_POINTS = [
  {
    icon: 'local-gas-station' as const,
    title: 'Real fuel economy',
    body: 'Log fill-ups and see what your car actually returns — not what the brochure claimed.',
  },
  {
    icon: 'build' as const,
    title: 'Service on time',
    body: 'Track intervals by both date and mileage, and get told before something is overdue.',
  },
  {
    icon: 'folder' as const,
    title: 'Papers in one place',
    body: 'Registration, insurance and inspection, with reminders well before they lapse.',
  },
];

export default function OnboardingWelcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 24,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ gap: 32 }}>
        <View style={{ gap: 12 }}>
          <Text variant="displayMediumEmphasized" accessibilityRole="header">
            Welcome to CarBuddy
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            Everything about running your car, in one place.
          </Text>
        </View>

        <View style={{ gap: 24 }}>
          {VALUE_POINTS.map((point) => (
            <View key={point.title} style={{ flexDirection: 'row', gap: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.secondaryContainer,
                }}
              >
                <MaterialIcons
                  name={point.icon}
                  size={24}
                  color={theme.colors.onSecondaryContainer}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="titleMedium">{point.title}</Text>
                <Text variant="bodyMedium" color="onSurfaceVariant">
                  {point.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Button
          label="Get started"
          size="large"
          fullWidth
          trailingIcon="arrow-forward"
          onPress={() => router.push('/(onboarding)/units')}
        />
        <Text variant="bodySmall" color="onSurfaceVariant" align="center">
          Takes about a minute. You can change anything later.
        </Text>
      </View>
    </View>
  );
}
