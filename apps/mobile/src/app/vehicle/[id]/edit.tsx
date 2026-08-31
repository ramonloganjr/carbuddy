import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  fromKilometres,
  fromLitres,
  toKilometres,
  toLitres,
  validateOdometerReading,
  validateVin,
  type EngineType,
  type Vehicle,
} from '@carbuddy/domain';
import { Chip, ChipGroup, Text, TextField, useSnackbar } from '../../../design-system';
import { RecordFormScreen, parseNumeric } from '../../../features/shared/RecordFormScreen';
import { getVehicle } from '../../../data/queries';
import { vehicleRepository } from '../../../data/repositories';
import { usePreferences } from '../../../features/settings/preferencesStore';
import { useVehicles } from '../../../features/vehicles/vehicleStore';
import { useSession } from '../../../features/auth/sessionStore';
import { useSync } from '../../../features/sync/syncStore';

const ENGINE_OPTIONS: { value: EngineType; label: string }[] = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'plugin_hybrid', label: 'Plug-in hybrid' },
  { value: 'electric', label: 'Electric' },
];

/**
 * Edit a vehicle.
 *
 * Presented as a modal from the detail screen. Only changed fields are written,
 * so two devices editing different parts of the same vehicle offline both keep
 * their edit when they sync.
 */
export default function EditVehicleScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { id } = useLocalSearchParams<{ id: string }>();

  const preferences = usePreferences((state) => state.preferences);
  const loadVehicles = useVehicles((state) => state.load);
  const userId = useSession((state) => state.userId);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const volumeUnit = preferences?.volumeUnit ?? 'l';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [nickname, setNickname] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [colour, setColour] = useState('');
  const [engineType, setEngineType] = useState<EngineType>('petrol');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [odometer, setOdometer] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getVehicle(id);
    if (!found) return;

    setVehicle(found);
    setNickname(found.nickname);
    setMake(found.make);
    setModel(found.model);
    setVariant(found.variant ?? '');
    setModelYear(found.modelYear ? String(found.modelYear) : '');
    setColour(found.colour ?? '');
    setEngineType(found.engineType ?? 'petrol');
    setPlate(found.plateNumber ?? '');
    setVin(found.vin ?? '');
    setTankCapacity(
      found.fuelTankCapacityL
        ? String(fromLitres(found.fuelTankCapacityL, volumeUnit).toFixed(1))
        : '',
    );
    setOdometer(String(Math.round(fromKilometres(found.currentOdometerKm, distanceUnit))));
  }, [distanceUnit, id, volumeUnit]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!vehicle) {
    return (
      <RecordFormScreen
        title="Edit vehicle"
        submitLabel="Save"
        canSubmit={false}
        saving={false}
        onSubmit={() => undefined}
      >
        {null}
      </RecordFormScreen>
    );
  }

  const odometerKm = toKilometres(parseNumeric(odometer), distanceUnit);
  // Compare against the *purchase* reading, not the current one: editing a
  // typo downward is a legitimate correction here, unlike logging a new reading.
  const odometerCheck = validateOdometerReading(odometerKm, vehicle.purchaseOdometerKm ?? null);
  const vinCheck = vin.trim().length > 0 ? validateVin(vin) : null;
  const canSubmit = make.trim().length > 0 && odometerCheck.valid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      const patch: Record<string, unknown> = {};
      const set = (column: string, next: unknown, current: unknown) => {
        if (next !== current) patch[column] = next;
      };

      set('nickname', nickname.trim(), vehicle.nickname);
      set('make', make.trim(), vehicle.make);
      set('model', model.trim(), vehicle.model);
      set('variant', variant.trim() || null, vehicle.variant ?? null);
      set(
        'model_year',
        modelYear.trim() ? parseNumeric(modelYear) : null,
        vehicle.modelYear ?? null,
      );
      set('colour', colour.trim() || null, vehicle.colour ?? null);
      set('engine_type', engineType, vehicle.engineType ?? null);
      set('plate_number', plate.trim().toUpperCase() || null, vehicle.plateNumber ?? null);
      set('vin', vin.trim().toUpperCase() || null, vehicle.vin ?? null);
      set(
        'fuel_tank_capacity_l',
        tankCapacity.trim() ? toLitres(parseNumeric(tankCapacity), volumeUnit) : null,
        vehicle.fuelTankCapacityL ?? null,
      );

      if (odometerKm !== vehicle.currentOdometerKm) {
        patch.current_odometer_km = odometerKm;
        patch.odometer_updated_at = new Date().toISOString();
      }

      if (Object.keys(patch).length === 0) {
        router.back();
        return;
      }

      await vehicleRepository.update(vehicle.id, patch);
      if (userId) await loadVehicles(userId);

      router.back();
      snackbar.show({ message: 'Vehicle updated.', tone: 'success' });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save those changes',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="Edit vehicle"
      submitLabel="Save changes"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <TextField label="Nickname" value={nickname} onChangeText={setNickname} />
      <TextField label="Make" value={make} onChangeText={setMake} required />
      <TextField label="Model" value={model} onChangeText={setModel} />
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
      </View>

      <TextField
        label="Odometer"
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="numeric"
        suffix={distanceUnit}
        leadingIcon="speed"
        error={!odometerCheck.valid ? 'Enter a valid odometer reading.' : undefined}
        supportingText="Correcting a typo here is fine — this does not create a new reading."
      />

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
    </RecordFormScreen>
  );
}
