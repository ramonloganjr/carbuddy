import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../design-system';

export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    />
  );
}
