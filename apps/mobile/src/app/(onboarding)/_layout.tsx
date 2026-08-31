import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../design-system';

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface },
        // Back must stay available: someone who mistyped their units should be
        // able to step back rather than restart onboarding.
        gestureEnabled: true,
      }}
    />
  );
}
