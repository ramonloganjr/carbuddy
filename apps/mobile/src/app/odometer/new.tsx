import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { fromKilometres, toKilometres, validateOdometerReading } from '@carbuddy/domain';
import { Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen, parseNumeric } from '../../features/shared/RecordFormScreen';
import { generateId, odometerRepository, vehicleRepository } from '../../data/repositories';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

/**
 * Record an odometer reading.
 *
 * Mainly for users who drive an electric vehicle or do not log every fill-up:
 * without a current reading, every mileage-based service reminder drifts out of
 * date and starts quietly under-reporting.
 */
export default function NewOdometerScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const vehicle = useVehicles((state) => state.selected());
  const loadVehicles = useVehicles((state) => state.load);
  const preferences = usePreferences((state) => state.preferences);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';

  const [reading, setReading] = useState(
    vehicle ? String(Math.round(fromKilometres(vehicle.currentOdometerKm, distanceUnit))) : '',
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const odometerKm = toKilometres(parseNumeric(reading), distanceUnit);
  const check = useMemo(
    () => validateOdometerReading(odometerKm, vehicle?.currentOdometerKm ?? null),
    [odometerKm, vehicle],
  );

  const canSubmit = Boolean(vehicle) && reading.trim().length > 0 && check.valid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !vehicle) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();

      await odometerRepository.create({
        id: generateId(),
        vehicleId: vehicle.id,
        odometerKm,
        recordedAt: now,
        source: 'manual',
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      await vehicleRepository.update(vehicle.id, {
        current_odometer_km: odometerKm,
        odometer_updated_at: now,
      });
      await loadVehicles(vehicle.userId);

      router.back();
      snackbar.show({
        message: `Odometer updated to ${format.distance(odometerKm)}.`,
        tone: 'success',
      });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that reading',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="Update odometer"
      submitLabel="Save reading"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <TextField
        label="Current reading"
        value={reading}
        onChangeText={setReading}
        keyboardType="numeric"
        required
        suffix={distanceUnit}
        leadingIcon="speed"
        error={
          !check.valid
            ? check.reason === 'decreasing'
              ? 'That is lower than your last reading. Check the number.'
              : check.reason === 'implausible_jump'
                ? 'That is a very large jump. Check the number.'
                : 'Enter a valid reading.'
            : undefined
        }
        supportingText={
          check.valid && check.warning === 'large_jump'
            ? 'A big jump since last time — worth double-checking.'
            : vehicle
              ? `Last recorded: ${format.distance(vehicle.currentOdometerKm)}`
              : undefined
        }
      />

      <Text variant="bodySmall" color="onSurfaceVariant">
        Keeping this current is what lets CarBuddy tell you a service is "about five weeks away"
        rather than "3,200 km away".
      </Text>

      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
    </RecordFormScreen>
  );
}
