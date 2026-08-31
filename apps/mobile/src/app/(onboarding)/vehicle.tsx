import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  starterSchedules,
  toKilometres,
  type EngineType,
  type PowertrainProfile,
} from '@carbuddy/domain';
import { Button, Chip, ChipGroup, Text, TextField, useSnackbar } from '../../design-system';
import { generateId, scheduleRepository, vehicleRepository } from '../../data/repositories';
import { useSession } from '../../features/auth/sessionStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';

const ENGINE_OPTIONS: { value: EngineType; label: string; profile: PowertrainProfile }[] = [
  { value: 'petrol', label: 'Petrol', profile: 'petrol' },
  { value: 'diesel', label: 'Diesel', profile: 'diesel' },
  { value: 'hybrid', label: 'Hybrid', profile: 'hybrid' },
  { value: 'electric', label: 'Electric', profile: 'electric' },
];

/**
 * Add the first vehicle.
 *
 * Four fields, only two of them required. Everything else — VIN, tyre sizes,
 * financing — is available later on the vehicle profile. Asking for it now
 * would turn a one-minute setup into a form nobody finishes, and none of it is
 * needed before the app becomes useful.
 */
export default function OnboardingVehicle() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const snackbar = useSnackbar();

  const userId = useSession((state) => state.userId);
  const preferences = usePreferences((state) => state.preferences);
  const updatePreferences = usePreferences((state) => state.update);
  const loadVehicles = useVehicles((state) => state.load);

  const [nickname, setNickname] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [odometer, setOdometer] = useState('');
  const [engineType, setEngineType] = useState<EngineType>('petrol');
  const [saving, setSaving] = useState(false);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const odometerValue = Number(odometer.replace(/[^\d.]/g, ''));
  const canSubmit = make.trim().length > 0 && Number.isFinite(odometerValue) && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const vehicleId = generateId();
      // Input is in the user's unit; storage is always kilometres.
      const odometerKm = toKilometres(odometerValue || 0, distanceUnit);

      await vehicleRepository.create({
        id: vehicleId,
        userId,
        nickname: nickname.trim() || `${make.trim()} ${model.trim()}`.trim(),
        make: make.trim(),
        model: model.trim(),
        engineType,
        currency: preferences?.currency ?? 'USD',
        currentOdometerKm: odometerKm,
        odometerUpdatedAt: now,
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      });

      // Seed a starter service schedule matched to the powertrain, so the app
      // is useful on day one instead of being an empty log.
      const profile =
        ENGINE_OPTIONS.find((option) => option.value === engineType)?.profile ?? 'petrol';

      for (const template of starterSchedules(profile)) {
        await scheduleRepository.create({
          id: generateId(),
          vehicleId,
          category: template.category,
          title: template.title,
          ...(template.intervalMonths !== undefined
            ? { intervalMonths: template.intervalMonths }
            : {}),
          ...(template.intervalDistanceKm !== undefined
            ? { intervalDistanceKm: template.intervalDistanceKm }
            : {}),
          // Anchored to today's reading; the first logged service re-anchors it.
          lastServicedAt: now,
          lastServiceOdometerKm: odometerKm,
          enabled: true,
        });
      }

      await updatePreferences({
        defaultVehicleId: vehicleId,
        onboardingCompletedAt: now,
      });
      await loadVehicles(userId);

      router.replace('/(tabs)');
      snackbar.show({
        message: `${make.trim()} added. Log a fill-up to get started.`,
        tone: 'success',
      });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that vehicle',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Text variant="headlineLargeEmphasized" accessibilityRole="header">
            Add your car
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            Just the basics for now. You can fill in the details later.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <TextField
            label="Make"
            value={make}
            onChangeText={setMake}
            required
            leadingIcon="directions-car"
          />
          <TextField label="Model" value={model} onChangeText={setModel} />
          <TextField
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            supportingText="Optional — what you actually call it"
          />
          <TextField
            label="Current odometer"
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="numeric"
            required
            suffix={distanceUnit}
            leadingIcon="speed"
          />

          <View style={{ gap: 8 }}>
            <Text variant="titleMedium">What does it run on?</Text>
            <ChipGroup>
              {ENGINE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  variant="filter"
                  selected={engineType === option.value}
                  onPress={() => setEngineType(option.value)}
                />
              ))}
            </ChipGroup>
            <Text variant="bodySmall" color="onSurfaceVariant">
              This sets up a sensible starting service schedule. Every interval is editable.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ padding: 24, paddingBottom: insets.bottom + 24 }}>
        <Button
          label="Finish setup"
          size="large"
          fullWidth
          loading={saving}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
