import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { analyseConsumption, type ConsumptionSegment, type FuelRecord } from '@carbuddy/domain';
import { Card, Dialog, Text, useSnackbar } from '../../design-system';
import { DetailRow, DetailScreen } from '../../features/shared/DetailScreen';
import { fuelRepository } from '../../data/repositories';
import { listFuelRecords } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

export default function FuelRecordDetailScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicles((state) => state.selected());
  const syncNow = useSync((state) => state.syncNow);

  const [record, setRecord] = useState<FuelRecord | null>(null);
  const [segment, setSegment] = useState<ConsumptionSegment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id || !vehicle) return;
    const [found, all] = await Promise.all([fuelRepository.get(id), listFuelRecords(vehicle.id)]);
    setRecord(found);
    // The segment this fill-up *closed*, so the detail can show what that tank
    // actually returned rather than a lifetime average.
    setSegment(analyseConsumption(all).segments.find((s) => s.toRecordId === id) ?? null);
  }, [id, vehicle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!record) {
    return <DetailScreen title="Fill-up">{null}</DetailScreen>;
  }

  const handleDelete = async () => {
    await fuelRepository.softDelete(record.id);
    router.back();
    snackbar.show({
      message: 'Fill-up deleted.',
      actionLabel: 'Undo',
      onAction: () => void fuelRepository.restore(record.id),
    });
    void syncNow({ silent: true });
  };

  const unitPrice = record.litres > 0 ? record.totalCost / record.litres : null;

  return (
    <DetailScreen
      title={record.stationName ?? 'Fill-up'}
      subtitle={format.dateTime(record.filledAt)}
      actions={[
        {
          icon: 'delete-outline',
          accessibilityLabel: 'Delete this fill-up',
          onPress: () => setConfirmDelete(true),
        },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card variant="filled" style={{ flex: 1 }}>
          <View style={{ gap: 4 }}>
            <Text variant="labelMedium" color="onSurfaceVariant">
              Total paid
            </Text>
            <Text variant="numericMedium" adjustsFontSizeToFit numberOfLines={1}>
              {format.money(record.totalCost)}
            </Text>
          </View>
        </Card>
        <Card variant="filled" style={{ flex: 1 }}>
          <View style={{ gap: 4 }}>
            <Text variant="labelMedium" color="onSurfaceVariant">
              This tank
            </Text>
            <Text variant="numericMedium" adjustsFontSizeToFit numberOfLines={1}>
              {segment ? format.economy(segment.efficiency) : '—'}
            </Text>
          </View>
        </Card>
      </View>

      {!segment ? (
        <Card variant="outlined">
          <Text variant="bodySmall" color="onSurfaceVariant">
            {record.isFullTank
              ? 'Fuel economy needs a previous full tank to measure against. The next full fill-up will produce a figure.'
              : 'This was a partial fill, so it does not close a measurement on its own — its fuel counts toward the next full tank.'}
          </Text>
        </Card>
      ) : null}

      <Card variant="filled" padding={4}>
        <DetailRow label="Odometer" value={format.distance(record.odometerKm)} />
        <DetailRow label="Volume" value={format.volume(record.litres)} />
        <DetailRow
          label="Price per unit"
          value={unitPrice !== null ? format.money(Math.round(unitPrice)) : null}
        />
        <DetailRow label="Fill" value={record.isFullTank ? 'Full tank' : 'Partial fill'} />
        {record.missedFill ? (
          <DetailRow label="Note" value="A previous fill was not logged" />
        ) : null}
        <DetailRow label="Station" value={record.stationName} />
        <DetailRow label="Fuel type" value={record.fuelType} />
      </Card>

      {segment ? (
        <Card variant="filled" padding={4}>
          <DetailRow label="Distance since last fill" value={format.distance(segment.distanceKm)} />
          <DetailRow label="Fuel used" value={format.volume(segment.litres)} />
          <DetailRow label="Cost of that fuel" value={format.money(segment.cost)} />
          <DetailRow
            label={`Fuel cost per ${format.distanceUnit}`}
            value={format.costPerDistance(segment.cost / segment.distanceKm)}
          />
          <DetailRow label="Days between fills" value={`${segment.days}`} />
        </Card>
      ) : null}

      {record.notes ? (
        <Card variant="outlined">
          <Text variant="bodyMedium">{record.notes}</Text>
        </Card>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
        title="Delete this fill-up?"
        description="Removing it will change your fuel economy and spending figures. You can undo this immediately afterwards."
        icon="delete-outline"
        destructive
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </DetailScreen>
  );
}
