import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  COMPONENT_LABEL,
  DEFAULT_COMPONENT_LIFE,
  fromKilometres,
  toKilometres,
  toMinorUnits,
  type ComponentKind,
} from '@carbuddy/domain';
import { Chip, ChipGroup, Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen, parseNumeric } from '../../features/shared/RecordFormScreen';
import { componentRepository, generateId } from '../../data/repositories';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useSync } from '../../features/sync/syncStore';

const KINDS: ComponentKind[] = [
  'tyre_set',
  'battery',
  'brake_pads_front',
  'brake_pads_rear',
  'air_filter',
  'cabin_filter',
  'spark_plugs',
  'wiper_blades',
  'timing_belt',
  'custom',
];

/**
 * Add a wear item.
 *
 * The expected-life fields are pre-filled from the built-in estimates for the
 * chosen kind, and labelled as estimates. That way tracking starts working
 * immediately for someone who does not know their tyres' rated life, while
 * anyone who does can overwrite it.
 */
export default function NewComponentScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const vehicle = useVehicles((state) => state.selected());
  const preferences = usePreferences((state) => state.preferences);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const currency = preferences?.currency ?? 'USD';

  const [kind, setKind] = useState<ComponentKind>('tyre_set');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [specification, setSpecification] = useState('');
  const [odometer, setOdometer] = useState(
    vehicle ? String(Math.round(fromKilometres(vehicle.currentOdometerKm, distanceUnit))) : '',
  );
  const [price, setPrice] = useState('');
  const [lifeMonths, setLifeMonths] = useState('');
  const [lifeDistance, setLifeDistance] = useState('');
  const [saving, setSaving] = useState(false);

  const applyDefaults = (nextKind: ComponentKind) => {
    setKind(nextKind);
    const defaults = DEFAULT_COMPONENT_LIFE[nextKind] ?? {};
    setLifeMonths(defaults.months ? String(defaults.months) : '');
    setLifeDistance(
      defaults.km ? String(Math.round(fromKilometres(defaults.km, distanceUnit))) : '',
    );
  };

  const canSubmit = Boolean(vehicle) && odometer.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !vehicle) return;
    setSaving(true);

    try {
      await componentRepository.create({
        id: generateId(),
        vehicleId: vehicle.id,
        kind,
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(specification.trim() ? { specification: specification.trim() } : {}),
        installedAt: new Date().toISOString(),
        installedOdometerKm: toKilometres(parseNumeric(odometer), distanceUnit),
        ...(price.trim()
          ? { purchasePrice: toMinorUnits(parseNumeric(price), currency), currency }
          : {}),
        ...(lifeMonths.trim() ? { expectedLifeMonths: parseNumeric(lifeMonths) } : {}),
        ...(lifeDistance.trim()
          ? { expectedLifeKm: toKilometres(parseNumeric(lifeDistance), distanceUnit) }
          : {}),
        ...(kind === 'tyre_set' ? { rotationIntervalKm: 10_000 } : {}),
      });

      router.back();
      snackbar.show({ message: `${COMPONENT_LABEL[kind]} added.`, tone: 'success' });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that part',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="Add a part"
      submitLabel="Save part"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">What is it?</Text>
        <ChipGroup>
          {KINDS.map((option) => (
            <Chip
              key={option}
              label={COMPONENT_LABEL[option]}
              variant="filter"
              selected={kind === option}
              onPress={() => applyDefaults(option)}
            />
          ))}
        </ChipGroup>
      </View>

      <TextField label="Brand" value={brand} onChangeText={setBrand} />
      <TextField
        label="Specification"
        value={specification}
        onChangeText={setSpecification}
        supportingText={
          kind === 'tyre_set'
            ? 'e.g. 205/55 R16 91V'
            : kind === 'battery'
              ? 'e.g. 12V 60Ah 680CCA'
              : 'Model or part number'
        }
      />
      {kind === 'custom' ? (
        <TextField label="Name" value={label} onChangeText={setLabel} required />
      ) : null}

      <TextField
        label="Fitted at"
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="numeric"
        required
        suffix={distanceUnit}
        leadingIcon="speed"
      />

      <TextField
        label="Price paid"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        suffix={currency}
        supportingText="Lets CarBuddy work out what this part costs per kilometre."
      />

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">Expected life</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextField
            label="Months"
            value={lifeMonths}
            onChangeText={setLifeMonths}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <TextField
            label="Distance"
            value={lifeDistance}
            onChangeText={setLifeDistance}
            keyboardType="number-pad"
            suffix={distanceUnit}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <Text variant="bodySmall" color="onSurfaceVariant">
          Pre-filled with a typical service life. Replace with the manufacturer's figure if you have
          it — whichever bound runs out first is what CarBuddy warns on.
        </Text>
      </View>
    </RecordFormScreen>
  );
}
