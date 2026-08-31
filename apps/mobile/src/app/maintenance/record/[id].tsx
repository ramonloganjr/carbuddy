import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAINTENANCE_CATEGORY_LABEL, type MaintenanceRecord } from '@carbuddy/domain';
import { Card, Dialog, Text, useSnackbar } from '../../../design-system';
import { DetailRow, DetailScreen } from '../../../features/shared/DetailScreen';
import { maintenanceRepository } from '../../../data/repositories';
import { useFormatters } from '../../../features/settings/useFormatters';
import { useSync } from '../../../features/sync/syncStore';

export default function MaintenanceRecordDetailScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const syncNow = useSync((state) => state.syncNow);

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRecord(await maintenanceRepository.get(id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!record) return <DetailScreen title="Service">{null}</DetailScreen>;

  const handleDelete = async () => {
    await maintenanceRepository.softDelete(record.id);
    router.back();
    snackbar.show({
      message: 'Service record deleted.',
      actionLabel: 'Undo',
      onAction: () => void maintenanceRepository.restore(record.id),
    });
    void syncNow({ silent: true });
  };

  return (
    <DetailScreen
      title={record.title ?? MAINTENANCE_CATEGORY_LABEL[record.category]}
      subtitle={format.date(record.servicedAt)}
      actions={[
        {
          icon: 'delete-outline',
          accessibilityLabel: 'Delete this service record',
          onPress: () => setConfirmDelete(true),
        },
      ]}
    >
      <Card variant="filled">
        <Text variant="labelMedium" color="onSurfaceVariant">
          Total cost
        </Text>
        <Text variant="numericLarge" adjustsFontSizeToFit numberOfLines={1}>
          {format.money(record.totalCost)}
        </Text>
      </Card>

      <Card variant="filled" padding={4}>
        <DetailRow label="Category" value={MAINTENANCE_CATEGORY_LABEL[record.category]} />
        <DetailRow label="Odometer" value={format.distance(record.odometerKm)} />
        <DetailRow label="Where" value={record.providerName} />
        <DetailRow
          label="Parts"
          value={record.partsCost > 0 ? format.money(record.partsCost) : null}
        />
        <DetailRow
          label="Labour"
          value={record.labourCost > 0 ? format.money(record.labourCost) : null}
        />
        <DetailRow label="Tax" value={record.taxCost > 0 ? format.money(record.taxCost) : null} />
        <DetailRow
          label="Warranty"
          value={record.warrantyMonths ? `${record.warrantyMonths} months` : null}
        />
        <DetailRow
          label="Next service due"
          value={record.nextServiceDate ? format.date(record.nextServiceDate) : null}
        />
      </Card>

      {record.partsReplaced && record.partsReplaced.length > 0 ? (
        <Card variant="outlined">
          <Text variant="titleSmall">Parts replaced</Text>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            {record.partsReplaced.join(', ')}
          </Text>
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
        title="Delete this service record?"
        description="Removing it will change your maintenance spending figures. You can undo this immediately afterwards."
        icon="delete-outline"
        destructive
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </DetailScreen>
  );
}
