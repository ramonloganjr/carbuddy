import React from 'react';
import { Platform, View } from 'react-native';
import type { ThemeMode } from '@carbuddy/domain';
import { Card, SegmentedButtons, Switch, Text, useTheme } from '../../design-system';
import { SettingsScreen, SettingsSection } from '../../features/settings/SettingsScreen';
import { usePreferences } from '../../features/settings/preferencesStore';

export default function AppearanceSettingsScreen() {
  const theme = useTheme();
  const preferences = usePreferences((state) => state.preferences);
  const update = usePreferences((state) => state.update);

  if (!preferences) return <SettingsScreen title="Appearance">{null}</SettingsScreen>;

  return (
    <SettingsScreen title="Appearance">
      <SettingsSection title="Theme">
        <SegmentedButtons
          segments={[
            { value: 'system' as ThemeMode, label: 'System', icon: 'brightness-auto' },
            { value: 'light' as ThemeMode, label: 'Light', icon: 'light-mode' },
            { value: 'dark' as ThemeMode, label: 'Dark', icon: 'dark-mode' },
          ]}
          value={preferences.themeMode}
          onChange={(value) => void update({ themeMode: value })}
          accessibilityLabel="Theme"
        />
      </SettingsSection>

      <Card variant="filled" padding={0}>
        <Switch
          value={preferences.dynamicColour}
          onValueChange={(dynamicColour) => void update({ dynamicColour })}
          label="Dynamic colour"
          supportingText={
            Platform.OS === 'android'
              ? 'Take accent colours from your wallpaper'
              : 'Use a more expressive palette'
          }
        />
      </Card>

      <Card variant="filled" padding={0}>
        <Switch
          value={preferences.hapticsEnabled}
          onValueChange={(hapticsEnabled) => void update({ hapticsEnabled })}
          label="Haptic feedback"
          supportingText="A small vibration when you tap controls"
        />
      </Card>

      {/* A live preview of the generated palette. Worth showing because the
          colours are computed from a seed rather than fixed, so "dynamic
          colour" is otherwise an abstract promise. */}
      <SettingsSection title="Preview">
        <Card variant="filled">
          <View style={{ gap: 12 }}>
            <Text variant="titleMedium">Your palette</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['primary', 'secondary', 'tertiary', 'error'] as const).map((role) => (
                <View key={role} style={{ flex: 1, gap: 6, alignItems: 'center' }}>
                  <View
                    accessibilityElementsHidden
                    style={{
                      height: 48,
                      width: '100%',
                      borderRadius: theme.shape.medium,
                      backgroundColor: theme.colors[role],
                    }}
                  />
                  <Text variant="labelSmall" color="onSurfaceVariant">
                    {role}
                  </Text>
                </View>
              ))}
            </View>
            <Text variant="bodySmall" color="onSurfaceVariant">
              Every colour is generated from one seed, so contrast stays correct in light and dark
              and at higher contrast settings.
            </Text>
          </View>
        </Card>
      </SettingsSection>
    </SettingsScreen>
  );
}
