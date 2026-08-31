import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Switch, Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen } from '../../features/shared/RecordFormScreen';
import { getDatabase } from '../../data/db/database';
import { generateId } from '../../data/repositories';
import { useSession } from '../../features/auth/sessionStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';

function parseDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T09:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * A user's own reminder.
 *
 * The escape hatch for everything the app does not model: "swap to winter
 * tyres", "renew the parking permit", "book the valet before the wedding".
 */
export default function NewReminderScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const userId = useSession((state) => state.userId);
  const vehicle = useVehicles((state) => state.selected());

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [attachToVehicle, setAttachToVehicle] = useState(true);
  const [saving, setSaving] = useState(false);

  const dueIso = parseDate(dueAt);
  const dueInvalid = dueAt.trim().length > 0 && dueIso === null;
  const canSubmit = title.trim().length > 0 && !dueInvalid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);

    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO reminders
           (id, vehicle_id, title, body, due_at, lead_time_days, enabled, version, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 1);`,
        [
          generateId(),
          attachToVehicle && vehicle ? vehicle.id : null,
          title.trim(),
          body.trim() || null,
          dueIso,
          7,
          now,
          now,
        ],
      );

      router.back();
      snackbar.show({ message: 'Reminder saved.', tone: 'success' });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that reminder',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="New reminder"
      submitLabel="Save reminder"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <TextField
        label="What should we remind you about?"
        value={title}
        onChangeText={setTitle}
        required
        leadingIcon="notifications-active"
      />

      <TextField
        label="Due on"
        value={dueAt}
        onChangeText={setDueAt}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        leadingIcon="event"
        error={dueInvalid ? 'Use the format YYYY-MM-DD' : undefined}
        supportingText="You will get a heads-up a week before, and again on the day."
      />

      {vehicle ? (
        <Card variant="filled" padding={0}>
          <Switch
            value={attachToVehicle}
            onValueChange={setAttachToVehicle}
            label={`About ${vehicle.nickname}`}
            supportingText="Turn off for a reminder that is not about a specific vehicle"
          />
        </Card>
      ) : null}

      <TextField label="Details" value={body} onChangeText={setBody} multiline />

      <View>
        <Text variant="bodySmall" color="onSurfaceVariant">
          Reminders respect your quiet hours and daily limit, like everything else.
        </Text>
      </View>
    </RecordFormScreen>
  );
}
