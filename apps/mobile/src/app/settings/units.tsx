import React from 'react';
import { View } from 'react-native';
import {
  FUEL_ECONOMY_LONG_LABEL,
  UNIT_PRESETS,
  type DistanceUnit,
  type FuelEconomyStandard,
  type PressureUnit,
  type UnitPresetName,
  type VolumeUnit,
} from '@carbuddy/domain';
import { Card, ListItem, SegmentedButtons, Text, TextField } from '../../design-system';
import { SettingsScreen, SettingsSection } from '../../features/settings/SettingsScreen';
import { usePreferences } from '../../features/settings/preferencesStore';

const PRESET_LABELS: Record<UnitPresetName, string> = {
  metric: 'Metric — kilometres, litres, km/L',
  metricEurope: 'Metric — kilometres, litres, L/100km',
  us: 'US — miles, US gallons, MPG',
  uk: 'UK — miles, imperial gallons, MPG',
};

export default function UnitsSettingsScreen() {
  const preferences = usePreferences((state) => state.preferences);
  const update = usePreferences((state) => state.update);

  if (!preferences) return <SettingsScreen title="Units">{null}</SettingsScreen>;

  const matchingPreset = (Object.keys(UNIT_PRESETS) as UnitPresetName[]).find((name) => {
    const preset = UNIT_PRESETS[name];
    return (
      preset.distance === preferences.distanceUnit &&
      preset.volume === preferences.volumeUnit &&
      preset.economy === preferences.economyStandard
    );
  });

  return (
    <SettingsScreen
      title="Units and currency"
      description="Changing these updates every figure in the app immediately — nothing is re-entered."
    >
      <SettingsSection title="Quick presets">
        <Card variant="filled" padding={4}>
          {(Object.keys(UNIT_PRESETS) as UnitPresetName[]).map((name) => (
            <ListItem
              key={name}
              headline={PRESET_LABELS[name]}
              selected={matchingPreset === name}
              leadingIcon={
                matchingPreset === name ? 'radio-button-checked' : 'radio-button-unchecked'
              }
              onPress={() => {
                const preset = UNIT_PRESETS[name];
                void update({
                  distanceUnit: preset.distance,
                  volumeUnit: preset.volume,
                  economyStandard: preset.economy,
                  pressureUnit: preset.pressure,
                });
              }}
            />
          ))}
        </Card>
      </SettingsSection>

      {/* Individual overrides exist because plenty of people want miles with
          litres — a combination no single preset covers. */}
      <SettingsSection title="Distance">
        <SegmentedButtons
          segments={[
            { value: 'km' as DistanceUnit, label: 'Kilometres' },
            { value: 'mi' as DistanceUnit, label: 'Miles' },
          ]}
          value={preferences.distanceUnit}
          onChange={(value) => void update({ distanceUnit: value })}
          accessibilityLabel="Distance unit"
        />
      </SettingsSection>

      <SettingsSection title="Volume">
        <SegmentedButtons
          segments={[
            { value: 'l' as VolumeUnit, label: 'Litres' },
            { value: 'gal_us' as VolumeUnit, label: 'Gal (US)' },
            { value: 'gal_imp' as VolumeUnit, label: 'Gal (UK)' },
          ]}
          value={preferences.volumeUnit}
          onChange={(value) => void update({ volumeUnit: value })}
          accessibilityLabel="Volume unit"
        />
      </SettingsSection>

      <SettingsSection title="Fuel economy">
        <View style={{ gap: 8 }}>
          <SegmentedButtons
            segments={[
              { value: 'km_l' as FuelEconomyStandard, label: 'km/L' },
              { value: 'l_100km' as FuelEconomyStandard, label: 'L/100km' },
              { value: 'mpg_us' as FuelEconomyStandard, label: 'MPG US' },
              { value: 'mpg_imp' as FuelEconomyStandard, label: 'MPG UK' },
            ]}
            value={preferences.economyStandard}
            onChange={(value) => void update({ economyStandard: value })}
            accessibilityLabel="Fuel economy format"
          />
          <Text variant="bodySmall" color="onSurfaceVariant" style={{ paddingHorizontal: 4 }}>
            {FUEL_ECONOMY_LONG_LABEL[preferences.economyStandard]}
          </Text>
        </View>
      </SettingsSection>

      <SettingsSection title="Tyre pressure">
        <SegmentedButtons
          segments={[
            { value: 'kpa' as PressureUnit, label: 'kPa' },
            { value: 'bar' as PressureUnit, label: 'bar' },
            { value: 'psi' as PressureUnit, label: 'psi' },
          ]}
          value={preferences.pressureUnit}
          onChange={(value) => void update({ pressureUnit: value })}
          accessibilityLabel="Pressure unit"
        />
      </SettingsSection>

      <SettingsSection title="Currency">
        <TextField
          label="Currency code"
          value={preferences.currency}
          onChangeText={(value) => {
            const code = value.toUpperCase().slice(0, 3);
            // Only commit a complete ISO-4217 code; a partial one would format
            // every amount in the app as gibberish while being typed.
            if (code.length === 3) void update({ currency: code });
          }}
          autoCapitalize="characters"
          maxLength={3}
          leadingIcon="attach-money"
          supportingText="Three-letter ISO code, e.g. USD, EUR, GBP, PHP."
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
