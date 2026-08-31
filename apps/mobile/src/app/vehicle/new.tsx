import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  starterSchedules,
  toKilometres,
  toLitres,
  toMinorUnits,
  validateVin,
  type EngineType,
  type PowertrainProfile,
} from '@carbuddy/domain';
import {
  Button,
  Chip,
  ChipGroup,
  IconButton,
  Text,
  TextField,
  useSnackbar,
} from '../../design-system';
import { generateId, scheduleRepository, vehicleRepository } from '../../data/repositories';
import { useSession } from '../../features/auth/sessionStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useSync } from '../../features/sync/syncStore';

const ENGINE_OPTIONS: { value: EngineType; label: string; profile: PowertrainProfile }[] = [
  { value: 'petrol', label: 'Petrol', profile: 'petrol' },
  { value: 'diesel', label: 'Diesel', profile: 'diesel' },
  { value: 'hybrid', label: 'Hybrid', profile: 'hybrid' },
  { value: 'plugin_hybrid', label: 'Plug-in hybrid', profile: 'hybrid' },
  { value: 'electric', label: 'Electric', profile: 'electric' },
];

/**
 * Add a vehicle.
 *
 * Two required fields, everything else optional and collapsed behind "More
 * details". Someone adding a second car should be able to do it in fifteen
 * seconds; the full specification sheet is available to anyone who wants it and
 * demanded of nobody.
 */
export default function NewVehicleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const snackbar = useSnackbar();

  const userId = useSession((state) => state.userId);
  const preferences = usePreferences((state) => state.preferences);
  const loadVehicles = useVehicles((state) => state.load);
  const select = useVehicles((state) => state.select);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const volumeUnit = preferences?.volumeUnit ?? 'l';
  const currency = preferences?.currency ?? 'USD';

  const [nickname, setNickname] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [colour, setColour] = useState('');
  const [odometer, setOdometer] = useState('');
  const [engineType, setEngineType] = useState<EngineType>('petrol');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const numeric = (value: string) => {
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const vinCheck = vin.trim().length > 0 ? validateVin(vin) : null;
  const canSubmit = make.trim().length > 0 && odometer.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit || !userId) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const vehicleId = generateId();
      const odometerKm = toKilometres(numeric(odometer), distanceUnit);

      await vehicleRepository.create({
        id: vehicleId,
        userId,
        nickname: nickname.trim() || `${make.trim()} ${model.trim()}`.trim(),
        make: make.trim(),
        model: model.trim(),
        ...(variant.trim() ? { variant: variant.trim() } : {}),
        ...(modelYear.trim() ? { modelYear: numeric(modelYear) } : {}),
        ...(colour.trim() ? { colour: colour.trim() } : {}),
        engineType,
        ...(tankCapacity.trim()
          ? { fuelTankCapacityL: toLitres(numeric(tankCapacity), volumeUnit) }
          : {}),
        ...(plate.trim() ? { plateNumber: plate.trim().toUpperCase() } : {}),
        ...(vin.trim() ? { vin: vin.trim().toUpperCase() } : {}),
        ...(purchasePrice.trim()
          ? { purchasePrice: toMinorUnits(numeric(purchasePrice), currency) }
          : {}),
        currency,
        currentOdometerKm: odometerKm,
        odometerUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });

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
          lastServicedAt: now,
          lastServiceOdometerKm: odometerKm,
          enabled: true,
        });
      }

      await loadVehicles(userId);
      await select(vehicleId);

      router.back();
      snackbar.show({ message: `${make.trim()} added to your garage.`, tone: 'success' });
      void syncNow({ silent: true });
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingHorizontal: 8,
          paddingBottom: 8,
        }}
      >
        <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
        <Text variant="titleLarge" style={{ flex: 1 }} accessibilityRole="header">
          Add a vehicle
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Make"
          value={make}
          onChangeText={setMake}
          required
          leadingIcon="directions-car"
          error={touched && make.trim().length === 0 ? 'Required' : undefined}
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
          error={touched && odometer.trim().length === 0 ? 'Required' : undefined}
        />

        <View style={{ gap: 8 }}>
          <Text variant="titleMedium">Powertrain</Text>
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
            Sets up a starting service schedule. Every interval stays editable.
          </Text>
        </View>

        <Button
          label={showMore ? 'Fewer details' : 'More details'}
          variant="text"
          icon={showMore ? 'expand-less' : 'expand-more'}
          onPress={() => setShowMore((value) => !value)}
        />

        {showMore ? (
          <View style={{ gap: 16 }}>
            <TextField label="Variant or trim" value={variant} onChangeText={setVariant} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextField
                label="Model year"
                value={modelYear}
                onChangeText={setModelYear}
                keyboardType="number-pad"
                maxLength={4}
                containerStyle={{ flex: 1 }}
              />
              <TextField
                label="Colour"
                value={colour}
                onChangeText={setColour}
                containerStyle={{ flex: 1 }}
              />
            </View>
            <TextField
              label="Plate number"
              value={plate}
              onChangeText={setPlate}
              autoCapitalize="characters"
              leadingIcon="badge"
            />
            <TextField
              label="VIN or chassis number"
              value={vin}
              onChangeText={setVin}
              autoCapitalize="characters"
              maxLength={17}
              leadingIcon="fingerprint"
              // A failed checksum is a prompt to double-check, never a block:
              // several markets do not follow ISO-3779.
              supportingText={
                vinCheck && !vinCheck.valid && vinCheck.reason === 'checksum'
                  ? 'That VIN did not pass its check digit — worth confirming, but you can save it.'
                  : 'Stored encrypted and masked in lists.'
              }
            />
            <TextField
              label="Fuel tank capacity"
              value={tankCapacity}
              onChangeText={setTankCapacity}
              keyboardType="decimal-pad"
              suffix={volumeUnit === 'l' ? 'L' : 'gal'}
            />
            <TextField
              label="Purchase price"
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="decimal-pad"
              suffix={currency}
              supportingText="Used for total cost of ownership."
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Add vehicle"
          size="large"
          fullWidth
          loading={saving}
          disabled={!canSubmit}
          haptic="success"
          onPress={handleSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
