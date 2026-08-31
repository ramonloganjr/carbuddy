import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  averageDailyDistance,
  evaluateSchedules,
  starterSchedules,
  type ScheduleEvaluation,
} from '@carbuddy/domain';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ListItem,
  StatusPill,
  Text,
  useSnackbar,
} from '../../design-system';
import { DetailScreen } from '../../features/shared/DetailScreen';
import { generateId, scheduleRepository } from '../../data/repositories';
import { listFuelRecords, listSchedules } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { powertrainProfile } from '@carbuddy/domain';

export default function SchedulesScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const vehicle = useVehicles((state) => state.selected());

  const [evaluations, setEvaluations] = useState<ScheduleEvaluation[] | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!vehicle) {
      setEvaluations([]);
      return;
    }
    const [schedules, fuelRecords] = await Promise.all([
      listSchedules(vehicle.id),
      listFuelRecords(vehicle.id),
    ]);
    setEvaluations(
      evaluateSchedules(schedules, {
        now: new Date(),
        currentOdometerKm: vehicle.currentOdometerKm,
        averageDailyDistanceKm: averageDailyDistance(fuelRecords),
      }),
    );
  }, [vehicle]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Re-add the starter set, skipping anything already present.
   *
   * Useful after someone has deleted schedules and wants a sensible baseline
   * back without hand-entering a dozen intervals.
   */
  const restoreDefaults = async () => {
    if (!vehicle) return;
    setRestoring(true);
    try {
      const existing = await listSchedules(vehicle.id);
      const present = new Set(existing.map((schedule) => schedule.category));
      const now = new Date().toISOString();
      let added = 0;

      for (const template of starterSchedules(powertrainProfile(vehicle))) {
        if (present.has(template.category)) continue;
        await scheduleRepository.create({
          id: generateId(),
          vehicleId: vehicle.id,
          category: template.category,
          title: template.title,
          ...(template.intervalMonths !== undefined
            ? { intervalMonths: template.intervalMonths }
            : {}),
          ...(template.intervalDistanceKm !== undefined
            ? { intervalDistanceKm: template.intervalDistanceKm }
            : {}),
          lastServicedAt: now,
          lastServiceOdometerKm: vehicle.currentOdometerKm,
          enabled: true,
        });
        added += 1;
      }

      await load();
      snackbar.show({
        message:
          added === 0
            ? 'You already have all the standard schedules.'
            : `Added ${added} standard schedule${added === 1 ? '' : 's'}.`,
        tone: added === 0 ? 'default' : 'success',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <DetailScreen
      title="Service schedules"
      subtitle="Each one is tracked by time and by mileage — whichever comes first."
    >
      {evaluations === null ? null : evaluations.length === 0 ? (
        <EmptyState
          icon="event-repeat"
          title="No schedules yet"
          description="Add the standard set for this vehicle and adjust any interval that does not match your owner's manual."
          actionLabel="Add standard schedules"
          onAction={() => void restoreDefaults()}
          compact
        />
      ) : (
        <>
          <Card variant="filled" padding={4}>
            {evaluations.map((item, index) => (
              <React.Fragment key={item.scheduleId}>
                {index > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={item.title}
                  supportingText={item.reason}
                  leadingIcon="build"
                  trailingContent={
                    <StatusPill
                      status={item.status}
                      label={
                        item.status === 'overdue'
                          ? 'Overdue'
                          : item.status === 'due'
                            ? 'Due'
                            : item.status === 'due_soon'
                              ? 'Soon'
                              : item.status === 'unknown'
                                ? 'Off'
                                : 'OK'
                      }
                      size="small"
                    />
                  }
                  onPress={() => router.push(`/maintenance/${item.scheduleId}`)}
                />
              </React.Fragment>
            ))}
          </Card>

          <Button
            label="Add any missing standard schedules"
            variant="tonal"
            icon="playlist-add"
            fullWidth
            loading={restoring}
            onPress={() => void restoreDefaults()}
          />

          <View>
            <Text variant="bodySmall" color="onSurfaceVariant">
              These intervals are common practice, not manufacturer specifications for your exact
              model. Check your owner's manual and adjust anything that differs.
            </Text>
          </View>
        </>
      )}
    </DetailScreen>
  );
}
