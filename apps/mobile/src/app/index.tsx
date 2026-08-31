import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../features/auth/sessionStore';
import { usePreferences } from '../features/settings/preferencesStore';
import { useVehicles } from '../features/vehicles/vehicleStore';

/**
 * Entry gate.
 *
 * Three questions, in order: signed in? onboarded? has a vehicle? Each has one
 * destination, so the routing stays readable as the app grows rather than
 * becoming a chain of nested conditionals inside the tab layout.
 */
export default function Index() {
  const status = useSession((state) => state.status);
  const userId = useSession((state) => state.userId);
  const preferences = usePreferences((state) => state.preferences);
  const loadVehicles = useVehicles((state) => state.load);

  useEffect(() => {
    if (userId) void loadVehicles(userId);
  }, [loadVehicles, userId]);

  if (status === 'loading') return <View style={{ flex: 1 }} />;
  if (status === 'unauthenticated') return <Redirect href="/(auth)/sign-in" />;
  if (!preferences?.onboardingCompletedAt) return <Redirect href="/(onboarding)" />;

  return <Redirect href="/(tabs)" />;
}
