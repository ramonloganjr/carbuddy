import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  DOCUMENT_TYPE_LABEL,
  evaluateDocument,
  maskIdentifier,
  reminderOffsetsFor,
  type DocumentEvaluation,
  type VehicleDocument,
} from '@carbuddy/domain';
import { Button, Card, Dialog, StatusPill, Switch, Text, useSnackbar } from '../../design-system';
import { DetailRow, DetailScreen } from '../../features/shared/DetailScreen';
import { documentRepository } from '../../data/repositories';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

export default function DocumentDetailScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const syncNow = useSync((state) => state.syncNow);

  const [document, setDocument] = useState<VehicleDocument | null>(null);
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await documentRepository.get(id);
    setDocument(found);
    setEvaluation(found ? evaluateDocument(found, new Date()) : null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!document || !evaluation) return <DetailScreen title="Document">{null}</DetailScreen>;

  const handleDelete = async () => {
    await documentRepository.softDelete(document.id);
    router.back();
    snackbar.show({
      message: 'Document removed.',
      actionLabel: 'Undo',
      onAction: () => void documentRepository.restore(document.id),
    });
    void syncNow({ silent: true });
  };

  const toggleReminder = async (enabled: boolean) => {
    await documentRepository.update(document.id, { reminder_enabled: enabled ? 1 : 0 });
    await load();
  };

  const offsets = reminderOffsetsFor(document);

  return (
    <DetailScreen
      title={document.title}
      subtitle={DOCUMENT_TYPE_LABEL[document.type]}
      actions={[
        {
          icon: 'delete-outline',
          accessibilityLabel: 'Remove this document',
          onPress: () => setConfirmDelete(true),
        },
      ]}
    >
      <View style={{ paddingHorizontal: 4 }}>
        <StatusPill
          status={
            evaluation.status === 'expired'
              ? 'overdue'
              : evaluation.status === 'expiring_soon'
                ? 'due_soon'
                : evaluation.status === 'no_expiry'
                  ? 'unknown'
                  : 'ok'
          }
          label={evaluation.reason}
        />
      </View>

      <Card variant="filled" padding={4}>
        {/* Masked by default — a policy number is exactly the sort of thing
            that should not be readable over a shoulder. */}
        <DetailRow
          label="Number"
          value={
            document.documentNumber
              ? revealed
                ? document.documentNumber
                : maskIdentifier(document.documentNumber, 'policy')
              : null
          }
        />
        <DetailRow label="Issued by" value={document.issuer} />
        <DetailRow
          label="Issued"
          value={document.issuedAt ? format.date(document.issuedAt) : null}
        />
        <DetailRow
          label="Expires"
          value={document.expiresAt ? format.date(document.expiresAt) : 'No expiry date'}
        />
        <DetailRow
          label="Applies to"
          value={document.vehicleId ? 'This vehicle' : 'You, across all vehicles'}
        />
      </Card>

      {document.documentNumber ? (
        <Button
          label={revealed ? 'Hide number' : 'Reveal number'}
          variant="text"
          icon={revealed ? 'visibility-off' : 'visibility'}
          onPress={() => setRevealed((value) => !value)}
        />
      ) : null}

      {document.expiresAt ? (
        <Card variant="filled" padding={0}>
          <Switch
            value={document.reminderEnabled}
            onValueChange={(enabled) => void toggleReminder(enabled)}
            label="Remind me before it expires"
            supportingText={
              offsets.length > 0 ? `${offsets.join(', ')} days before` : 'No reminder schedule'
            }
          />
        </Card>
      ) : null}

      {document.notes ? (
        <Card variant="outlined">
          <Text variant="bodyMedium">{document.notes}</Text>
        </Card>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
        title={`Remove ${document.title}?`}
        description="Its reminders will stop. You can undo this immediately afterwards."
        icon="delete-outline"
        destructive
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
      />
    </DetailScreen>
  );
}
