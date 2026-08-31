import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Text, useTheme } from '../../design-system';

/**
 * Shared chrome for every settings screen: a back control, a large title, and a
 * scrolling body. Repeating this per screen is how settings sections slowly
 * drift apart from each other.
 */
export function SettingsScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
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
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 20,
        }}
      >
        <View style={{ gap: 8, paddingHorizontal: 4 }}>
          <Text variant="displaySmall" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="bodyMedium" color="onSurfaceVariant">
              {description}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

/** A labelled group of related settings rows. */
export function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
