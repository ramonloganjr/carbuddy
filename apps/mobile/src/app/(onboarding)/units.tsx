import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FUEL_ECONOMY_LONG_LABEL,
  UNIT_PRESETS,
  type FuelEconomyStandard,
  type UnitPresetName,
} from '@carbuddy/domain';
import { Button, Card, ListItem, SegmentedButtons, Text } from '../../design-system';
import { usePreferences } from '../../features/settings/preferencesStore';

const PRESET_LABELS: Record<UnitPresetName, string> = {
  metric: 'Metric (km/L)',
  metricEurope: 'Metric (L/100km)',
  us: 'US (miles, gallons)',
  uk: 'UK (miles, imperial gallons)',
};

const ECONOMY_OPTIONS: FuelEconomyStandard[] = ['km_l', 'l_100km', 'mpg_us', 'mpg_imp'];

/**
 * The units step.
 *
 * Pre-selected from the device locale, so for most people this is a screen they
 * glance at and pass. It exists because getting units wrong makes every number
 * in the app meaningless, and because plenty of people want miles with litres —
 * a combination no single preset covers, hence the individual override below.
 */
export default function OnboardingUnits() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const preferences = usePreferences((state) => state.preferences);
  const update = usePreferences((state) => state.update);

  const [economy, setEconomy] = useState<FuelEconomyStandard>(
    preferences?.economyStandard ?? 'km_l',
  );

  const applyPreset = async (name: UnitPresetName) => {
    const preset = UNIT_PRESETS[name];
    setEconomy(preset.economy);
    await update({
      distanceUnit: preset.distance,
      volumeUnit: preset.volume,
      economyStandard: preset.economy,
      pressureUnit: preset.pressure,
    });
  };

  const currentPreset = (Object.keys(UNIT_PRESETS) as UnitPresetName[]).find((name) => {
    const preset = UNIT_PRESETS[name];
    return (
      preset.distance === preferences?.distanceUnit &&
      preset.volume === preferences?.volumeUnit &&
      preset.economy === preferences?.economyStandard
    );
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: 24,
          gap: 24,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text variant="headlineLargeEmphasized" accessibilityRole="header">
            How do you measure?
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            We picked these from your device settings. Change them if they are not right.
          </Text>
        </View>

        <Card variant="filled" padding={4}>
          {(Object.keys(UNIT_PRESETS) as UnitPresetName[]).map((name) => (
            <ListItem
              key={name}
              headline={PRESET_LABELS[name]}
              selected={currentPreset === name}
              leadingIcon={
                currentPreset === name ? 'radio-button-checked' : 'radio-button-unchecked'
              }
              onPress={() => void applyPreset(name)}
            />
          ))}
        </Card>

        <View style={{ gap: 12 }}>
          <Text variant="titleMedium">Show fuel economy as</Text>
          <SegmentedButtons
            segments={ECONOMY_OPTIONS.map((option) => ({
              value: option,
              label:
                option === 'mpg_us'
                  ? 'MPG US'
                  : option === 'mpg_imp'
                    ? 'MPG UK'
                    : option === 'km_l'
                      ? 'km/L'
                      : 'L/100km',
            }))}
            value={economy}
            onChange={(value) => {
              setEconomy(value);
              void update({ economyStandard: value });
            }}
            accessibilityLabel="Fuel economy format"
          />
          <Text variant="bodySmall" color="onSurfaceVariant">
            {FUEL_ECONOMY_LONG_LABEL[economy]}
          </Text>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="titleMedium">Currency</Text>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            {preferences?.currency ?? 'USD'} — change this any time in Settings.
          </Text>
        </View>
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: insets.bottom + 24 }}>
        <Button
          label="Continue"
          size="large"
          fullWidth
          trailingIcon="arrow-forward"
          onPress={() => router.push('/(onboarding)/notifications')}
        />
      </View>
    </View>
  );
}
