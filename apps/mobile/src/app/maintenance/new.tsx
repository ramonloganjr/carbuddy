import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MAINTENANCE_CATEGORY_LABEL,
  rollForwardSchedule,
  toKilometres,
  toMinorUnits,
  type MaintenanceCategory,
} from '@carbuddy/domain';
import { Card, Chip, ChipGroup, Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen, parseNumeric } from '../../features/shared/RecordFormScreen';
import {
  generateId,
  maintenanceRepository,
  odometerRepository,
  scheduleRepository,
  vehicleRepository,
} from '../../data/repositories';
import { listSchedules } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useSync } from '../../features/sync/syncStore';

/** The categories people log most, kept one tap away. */
const COMMON_CATEGORIES: MaintenanceCategory[] = [
  'engine_oil',
  'general_service',
  'tyres',
  'brake_pads',
  'air_filter',
  'battery',
  'inspection',
  'repair',
];

export default function NewMaintenanceScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const vehicle = useVehicles((state) => state.selected());
  const loadVehicles = useVehicles((state) => state.load);
  const preferences = usePreferences((state) => state.preferences);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const currency = preferences?.currency ?? 'USD';

  const [category, setCategory] = useState<MaintenanceCategory>('engine_oil');
  const [title, setTitle] = useState('');
  const [odometer, setOdometer] = useState(
    vehicle
      ? String(
          Math.round(
            distanceUnit === 'km'
              ? vehicle.currentOdometerKm
              : vehicle.currentOdometerKm / 1.609344,
          ),
        )
      : '',
  );
  const [provider, setProvider] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [taxCost, setTaxCost] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Keep the total in step with the components as they are typed, but never
   * overwrite a total the user entered directly — receipts round in ways the
   * parts do not always reproduce, and the paper total is the one that counts.
   */
  const [totalEdited, setTotalEdited] = useState(false);
  const syncTotal = (parts: string, labour: string, tax: string) => {
    if (totalEdited) return;
    const sum = parseNumeric(parts) + parseNumeric(labour) + parseNumeric(tax);
    setTotalCost(sum > 0 ? sum.toFixed(2) : '');
  };

  const canSubmit = Boolean(vehicle) && odometer.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !vehicle) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const recordId = generateId();
      const odometerKm = toKilometres(parseNumeric(odometer), distanceUnit);

      await maintenanceRepository.create({
        id: recordId,
        vehicleId: vehicle.id,
        category,
        ...(title.trim() ? { title: title.trim() } : {}),
        servicedAt: now,
        odometerKm,
        ...(provider.trim() ? { providerName: provider.trim() } : {}),
        partsCost: toMinorUnits(parseNumeric(partsCost), currency),
        labourCost: toMinorUnits(parseNumeric(labourCost), currency),
        taxCost: toMinorUnits(parseNumeric(taxCost), currency),
        totalCost: toMinorUnits(parseNumeric(totalCost), currency),
        currency,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      await odometerRepository.create({
        id: generateId(),
        vehicleId: vehicle.id,
        odometerKm,
        recordedAt: now,
        source: 'maintenance_record',
        sourceId: recordId,
      });

      /**
       * Logging the work *is* resetting the reminder.
       *
       * Making the user separately update the schedule after every service is
       * the fastest way to end up with reminders nobody trusts.
       */
      const schedules = await listSchedules(vehicle.id);
      const matching = schedules.find((schedule) => schedule.category === category);
      if (matching) {
        const rolled = rollForwardSchedule(matching, [
          {
            id: recordId,
            vehicleId: vehicle.id,
            category,
            servicedAt: now,
            odometerKm,
            partsCost: 0,
            labourCost: 0,
            taxCost: 0,
            totalCost: 0,
            currency,
          },
        ]);
        await scheduleRepository.update(matching.id, {
          last_serviced_at: rolled.lastServicedAt ?? now,
          last_service_odometer: rolled.lastServiceOdometerKm ?? odometerKm,
        });
      }

      if (odometerKm > vehicle.currentOdometerKm) {
        await vehicleRepository.update(vehicle.id, {
          current_odometer_km: odometerKm,
          odometer_updated_at: now,
        });
        await loadVehicles(vehicle.userId);
      }

      router.back();
      snackbar.show({
        message: matching
          ? `Service logged. Your ${matching.title.toLowerCase()} reminder has been reset.`
          : 'Service logged.',
        tone: 'success',
      });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that service',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="Log a service"
      submitLabel="Save service"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">What was done?</Text>
        <ChipGroup>
          {COMMON_CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={MAINTENANCE_CATEGORY_LABEL[option]}
              variant="filter"
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </ChipGroup>
      </View>

      <TextField
        label="Description"
        value={title}
        onChangeText={setTitle}
        supportingText="Optional — defaults to the category above"
      />

      <TextField
        label="Odometer"
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="numeric"
        required
        suffix={distanceUnit}
        leadingIcon="speed"
      />

      <TextField label="Where" value={provider} onChangeText={setProvider} leadingIcon="store" />

      <Card variant="outlined">
        <View style={{ gap: 16 }}>
          <Text variant="titleMedium">Cost</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextField
              label="Parts"
              value={partsCost}
              onChangeText={(value) => {
                setPartsCost(value);
                syncTotal(value, labourCost, taxCost);
              }}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1 }}
            />
            <TextField
              label="Labour"
              value={labourCost}
              onChangeText={(value) => {
                setLabourCost(value);
                syncTotal(partsCost, value, taxCost);
              }}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <TextField
            label="Tax"
            value={taxCost}
            onChangeText={(value) => {
              setTaxCost(value);
              syncTotal(partsCost, labourCost, value);
            }}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Total paid"
            value={totalCost}
            onChangeText={(value) => {
              setTotalEdited(true);
              setTotalCost(value);
            }}
            keyboardType="decimal-pad"
            suffix={currency}
            supportingText="Adds up automatically — override it to match your receipt."
          />
        </View>
      </Card>

      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
    </RecordFormScreen>
  );
}
