import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  averageDailyDistance,
  evaluateSchedule,
  fromKilometres,
  toKilometres,
  type MaintenanceSchedule,
  type ScheduleEvaluation,
} from '@carbuddy/domain';
import {
  Button,
  Card,
  Dialog,
  LinearProgress,
  StatusPill,
  Switch,
  Text,
  TextField,
  useSnackbar,
} from '../../design-system';
import { DetailRow, DetailScreen } from '../../features/shared/DetailScreen';
import { scheduleRepository } from '../../data/repositories';
import { listFuelRecords } from '../../data/queries';
import { parseNumeric } from '../../features/shared/RecordFormScreen';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

/**
 * A service schedule.
 *
 * Both interval bounds are editable here, and the evaluation re-runs live, so
 * the effect of changing "every 10,000 km" to "every 15,000 km" is visible
 * before it is saved.
 */
export default function ScheduleDetailScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();

  const vehicle = useVehicles((state) => state.selected());
  const distanceUnit = usePreferences((state) => state.preferences?.distanceUnit ?? 'km');
  const syncNow = useSync((state) => state.syncNow);

  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [evaluation, setEvaluation] = useState<ScheduleEvaluation | null>(null);
  const [months, setMonths] = useState('');
  const [distance, setDistance] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id || !vehicle) return;
    const found = await scheduleRepository.get(id);
    if (!found) return;

    const fuelRecords = await listFuelRecords(vehicle.id);
    setSchedule(found);
    setMonths(found.intervalMonths ? String(found.intervalMonths) : '');
    setDistance(
      found.intervalDistanceKm
        ? String(Math.round(fromKilometres(found.intervalDistanceKm, distanceUnit)))
        : '',
    );
    setEvaluation(
      evaluateSchedule(found, {
        now: new Date(),
        currentOdometerKm: vehicle.currentOdometerKm,
        averageDailyDistanceKm: averageDailyDistance(fuelRecords),
      }),
    );
  }, [distanceUnit, id, vehicle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!schedule || !evaluation) return <DetailScreen title="Service">{null}</DetailScreen>;

  const saveIntervals = async () => {
    setSaving(true);
    try {
      await scheduleRepository.update(schedule.id, {
        interval_months: months.trim() ? parseNumeric(months) : null,
        interval_distance_km: distance.trim()
          ? toKilometres(parseNumeric(distance), distanceUnit)
          : null,
      });
      await load();
      snackbar.show({ message: 'Interval updated.', tone: 'success' });
      void syncNow({ silent: true });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    await scheduleRepository.update(schedule.id, { enabled: enabled ? 1 : 0 });
    await load();
  };

  const handleDelete = async () => {
    await scheduleRepository.softDelete(schedule.id);
    router.back();
    snackbar.show({
      message: 'Schedule removed.',
      actionLabel: 'Undo',
      onAction: () => void scheduleRepository.restore(schedule.id),
    });
  };

  return (
    <DetailScreen
      title={schedule.title}
      subtitle={evaluation.reason}
      actions={[
        {
          icon: 'delete-outline',
          accessibilityLabel: 'Remove this schedule',
          onPress: () => setConfirmDelete(true),
        },
      ]}
    >
      <View style={{ paddingHorizontal: 4 }}>
        <StatusPill
          status={evaluation.status}
          label={
            evaluation.driver === 'distance'
              ? 'Due by mileage'
              : evaluation.driver === 'time'
                ? 'Due by date'
                : 'Not tracked'
          }
        />
      </View>

      {evaluation.status !== 'unknown' ? (
        <Card variant="filled">
          <LinearProgress
            progress={evaluation.progress}
            status={evaluation.status}
            label="Progress since last service"
            accessibilityLabel={`${Math.round(evaluation.progress * 100)} percent through the interval. ${evaluation.reason}`}
          />
        </Card>
      ) : null}

      <Card variant="filled" padding={4}>
        <DetailRow
          label="Last done"
          value={schedule.lastServicedAt ? format.date(schedule.lastServicedAt) : 'Never logged'}
        />
        <DetailRow
          label="At"
          value={
            schedule.lastServiceOdometerKm !== undefined
              ? format.distance(schedule.lastServiceOdometerKm)
              : null
          }
        />
        <DetailRow
          label="Next due by date"
          value={evaluation.dueDate ? format.date(evaluation.dueDate) : 'Not set'}
        />
        <DetailRow
          label="Next due by mileage"
          value={
            evaluation.dueOdometerKm !== null
              ? format.distance(evaluation.dueOdometerKm)
              : 'Not set'
          }
        />
        <DetailRow
          label="Expected around"
          value={
            evaluation.effectiveDueDate
              ? format.date(evaluation.effectiveDueDate)
              : 'Not enough data'
          }
        />
      </Card>

      <Card variant="filled" padding={0}>
        <Switch
          value={schedule.enabled}
          onValueChange={(enabled) => void toggleEnabled(enabled)}
          label="Remind me about this"
          supportingText="Turn off to stop tracking without losing the history"
        />
      </Card>

      <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
        Interval
      </Text>
      <Card variant="outlined">
        <View style={{ gap: 16 }}>
          <Text variant="bodySmall" color="onSurfaceVariant">
            Set either or both. With both, whichever arrives first is what counts.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextField
              label="Every"
              value={months}
              onChangeText={setMonths}
              keyboardType="number-pad"
              suffix="months"
              containerStyle={{ flex: 1 }}
            />
            <TextField
              label="Or every"
              value={distance}
              onChangeText={setDistance}
              keyboardType="number-pad"
              suffix={distanceUnit}
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Button
            label="Save interval"
            variant="tonal"
            fullWidth
            loading={saving}
            onPress={() => void saveIntervals()}
          />
        </View>
      </Card>

      <Button
        label="Log this service now"
        variant="filled"
        icon="build"
        fullWidth
        onPress={() => router.push('/maintenance/new')}
      />

      <Dialog
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
        title={`Remove ${schedule.title}?`}
        description="Your service history stays; only this reminder is removed."
        icon="delete-outline"
        destructive
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
      />
    </DetailScreen>
  );
}
