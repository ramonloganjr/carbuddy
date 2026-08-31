import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  averageDailyDistance,
  componentCostPerKm,
  evaluateComponent,
  type ComponentEvaluation,
  type VehicleComponent,
} from '@carbuddy/domain';
import {
  Button,
  Card,
  Dialog,
  LinearProgress,
  StatusPill,
  Text,
  useSnackbar,
} from '../../design-system';
import { DetailRow, DetailScreen } from '../../features/shared/DetailScreen';
import { componentRepository } from '../../data/repositories';
import { listFuelRecords } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

export default function ComponentDetailScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicles((state) => state.selected());
  const syncNow = useSync((state) => state.syncNow);

  const [component, setComponent] = useState<VehicleComponent | null>(null);
  const [evaluation, setEvaluation] = useState<ComponentEvaluation | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const load = useCallback(async () => {
    if (!id || !vehicle) return;
    const found = await componentRepository.get(id);
    if (!found) return;
    const fuelRecords = await listFuelRecords(vehicle.id);
    setComponent(found);
    setEvaluation(
      evaluateComponent(found, {
        now: new Date(),
        currentOdometerKm: vehicle.currentOdometerKm,
        averageDailyDistanceKm: averageDailyDistance(fuelRecords),
      }),
    );
  }, [id, vehicle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!component || !evaluation) return <DetailScreen title="Part">{null}</DetailScreen>;

  /**
   * Retiring a part records *when* and *at what mileage* it came off, which is
   * what makes the cost-per-kilometre figure possible for the next set.
   */
  const retire = async () => {
    if (!vehicle) return;
    await componentRepository.update(component.id, {
      removed_at: new Date().toISOString(),
      removed_odometer_km: vehicle.currentOdometerKm,
    });
    router.back();
    snackbar.show({
      message: `${evaluation.label} marked as replaced.`,
      actionLabel: 'Undo',
      onAction: () => {
        void componentRepository.update(component.id, {
          removed_at: null,
          removed_odometer_km: null,
        });
      },
    });
    void syncNow({ silent: true });
  };

  const costPerKm = componentCostPerKm(component);

  return (
    <DetailScreen
      title={evaluation.label}
      subtitle={[component.brand, component.specification].filter(Boolean).join(' · ')}
    >
      <View style={{ paddingHorizontal: 4 }}>
        <StatusPill
          status={evaluation.status}
          label={
            evaluation.status === 'overdue'
              ? 'Past its expected life'
              : evaluation.status === 'due'
                ? 'Due for replacement'
                : evaluation.status === 'due_soon'
                  ? 'Wearing out'
                  : evaluation.status === 'unknown'
                    ? 'Not tracked'
                    : 'In good shape'
          }
        />
      </View>

      {evaluation.status !== 'unknown' ? (
        <Card variant="filled">
          <LinearProgress
            progress={evaluation.wear}
            status={evaluation.status}
            label={evaluation.reason}
            accessibilityLabel={`${evaluation.label}: ${Math.round(evaluation.wear * 100)} percent of expected life used`}
          />
        </Card>
      ) : null}

      <Card variant="filled" padding={4}>
        <DetailRow label="Fitted" value={format.date(component.installedAt)} />
        <DetailRow label="Fitted at" value={format.distance(component.installedOdometerKm)} />
        <DetailRow label="Distance since" value={format.distance(evaluation.distanceCoveredKm)} />
        <DetailRow label="Age" value={`${Math.round(evaluation.ageMonths)} months`} />
        <DetailRow
          label="Expected replacement"
          value={
            evaluation.estimatedReplacementDate
              ? format.date(evaluation.estimatedReplacementDate)
              : 'Not enough data'
          }
        />
        <DetailRow
          label="Price paid"
          value={component.purchasePrice ? format.money(component.purchasePrice) : null}
        />
        <DetailRow
          label={`Cost per ${format.distanceUnit}`}
          value={costPerKm !== null ? format.costPerDistance(costPerKm) : null}
        />
        <DetailRow
          label="Warranty"
          value={
            evaluation.warrantyDaysRemaining === null
              ? null
              : evaluation.warrantyActive
                ? `Active, ${evaluation.warrantyDaysRemaining} days left`
                : 'Expired'
          }
        />
        <DetailRow
          label="Next rotation"
          value={
            evaluation.rotationDueInKm === null
              ? null
              : evaluation.rotationDueInKm <= 0
                ? 'Due now'
                : `In ${format.distance(evaluation.rotationDueInKm)}`
          }
        />
      </Card>

      {evaluation.usingDefaultLife ? (
        <Card variant="outlined">
          <Text variant="bodySmall" color="onSurfaceVariant">
            This estimate uses a typical service life rather than a figure for your exact part. Have
            wear items inspected rather than relying on a date.
          </Text>
        </Card>
      ) : null}

      <Button
        label="Mark as replaced"
        variant="tonal"
        icon="autorenew"
        fullWidth
        onPress={() => setConfirmReplace(true)}
      />

      <Dialog
        visible={confirmReplace}
        onDismiss={() => setConfirmReplace(false)}
        title={`Mark ${evaluation.label} as replaced?`}
        description="It moves into your history at today's odometer reading, so CarBuddy can work out what it cost per kilometre."
        icon="autorenew"
        confirmLabel="Mark replaced"
        onConfirm={() => void retire()}
      />
    </DetailScreen>
  );
}
