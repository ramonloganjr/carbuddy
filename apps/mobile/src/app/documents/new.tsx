import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEFAULT_REMINDER_OFFSETS,
  DOCUMENT_TYPE_LABEL,
  DRIVER_DOCUMENT_TYPES,
  type DocumentType,
} from '@carbuddy/domain';
import { Card, Chip, ChipGroup, Switch, Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen } from '../../features/shared/RecordFormScreen';
import { documentRepository, generateId } from '../../data/repositories';
import { useSession } from '../../features/auth/sessionStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useSync } from '../../features/sync/syncStore';

const TYPES: DocumentType[] = [
  'insurance_policy',
  'vehicle_registration',
  'drivers_licence',
  'inspection_certificate',
  'road_tax',
  'warranty',
  'roadside_assistance',
  'purchase_agreement',
  'financing_agreement',
  'other',
];

/** Accepts `YYYY-MM-DD` and returns an ISO instant, or null if incomplete. */
function parseDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function NewDocumentScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const userId = useSession((state) => state.userId);
  const vehicle = useVehicles((state) => state.selected());
  const syncNow = useSync((state) => state.syncNow);

  const [type, setType] = useState<DocumentType>('insurance_policy');
  const [title, setTitle] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // A licence belongs to the driver, not the car, and must survive selling it.
  const isDriverDocument = DRIVER_DOCUMENT_TYPES.includes(type);
  const expiryIso = parseDate(expiresAt);
  const expiryInvalid = expiresAt.trim().length > 0 && expiryIso === null;
  const canSubmit = Boolean(userId) && !expiryInvalid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);

    try {
      await documentRepository.create({
        id: generateId(),
        userId,
        ...(isDriverDocument || !vehicle ? {} : { vehicleId: vehicle.id }),
        type,
        title: title.trim() || DOCUMENT_TYPE_LABEL[type],
        ...(documentNumber.trim() ? { documentNumber: documentNumber.trim() } : {}),
        ...(issuer.trim() ? { issuer: issuer.trim() } : {}),
        ...(expiryIso ? { expiresAt: expiryIso } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        reminderOffsetsDays: DEFAULT_REMINDER_OFFSETS[type],
        reminderEnabled,
      });

      router.back();
      snackbar.show({
        message: expiryIso
          ? 'Document saved. You will be reminded before it expires.'
          : 'Document saved.',
        tone: 'success',
      });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that document',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const offsets = DEFAULT_REMINDER_OFFSETS[type];

  return (
    <RecordFormScreen
      title="Add a document"
      submitLabel="Save document"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">Type</Text>
        <ChipGroup>
          {TYPES.map((option) => (
            <Chip
              key={option}
              label={DOCUMENT_TYPE_LABEL[option]}
              variant="filter"
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
        </ChipGroup>
        <Text variant="bodySmall" color="onSurfaceVariant">
          {isDriverDocument
            ? 'Belongs to you rather than to one vehicle, so it shows under every car.'
            : vehicle
              ? `Will be filed under ${vehicle.nickname}.`
              : 'Will be filed under your account.'}
        </Text>
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        supportingText={`Optional — defaults to "${DOCUMENT_TYPE_LABEL[type]}"`}
      />

      <TextField
        label="Document or policy number"
        value={documentNumber}
        onChangeText={setDocumentNumber}
        autoCapitalize="characters"
        leadingIcon="tag"
        supportingText="Stored encrypted and masked in lists."
      />

      <TextField
        label="Issued by"
        value={issuer}
        onChangeText={setIssuer}
        leadingIcon="account-balance"
      />

      <TextField
        label="Expires on"
        value={expiresAt}
        onChangeText={setExpiresAt}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        leadingIcon="event"
        error={expiryInvalid ? 'Use the format YYYY-MM-DD' : undefined}
      />

      <Card variant="filled" padding={0}>
        <Switch
          value={reminderEnabled}
          onValueChange={setReminderEnabled}
          label="Remind me before it expires"
          supportingText={
            offsets.length > 0
              ? `${offsets.join(', ')} days before`
              : 'No default schedule for this type'
          }
          disabled={!expiryIso}
        />
      </Card>

      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
    </RecordFormScreen>
  );
}
