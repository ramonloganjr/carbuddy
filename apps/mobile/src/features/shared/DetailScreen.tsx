import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MaterialIcons } from '@expo/vector-icons';
import { IconButton, Text, useTheme } from '../../design-system';

export interface DetailAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
}

/** Shared chrome for record detail screens: back, actions, title, body. */
export function DetailScreen({
  title,
  subtitle,
  actions = [],
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: readonly DetailAction[];
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingHorizontal: 8,
          paddingBottom: 8,
        }}
      >
        <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        {actions.map((action) => (
          <IconButton
            key={action.accessibilityLabel}
            icon={action.icon}
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text variant="headlineLargeEmphasized" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyLarge" color="onSurfaceVariant">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

/** A label/value row that renders nothing when the value is absent. */
export function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
      }}
    >
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text
        variant="bodyLarge"
        style={{ color: theme.colors.onSurface, textAlign: 'right', flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}
