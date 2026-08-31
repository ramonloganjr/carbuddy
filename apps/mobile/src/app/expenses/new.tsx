import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EXPENSE_CATEGORY_LABEL, toMinorUnits, type ExpenseCategory } from '@carbuddy/domain';
import { Chip, ChipGroup, Text, TextField, useSnackbar } from '../../design-system';
import { RecordFormScreen, parseNumeric } from '../../features/shared/RecordFormScreen';
import { expenseRepository, generateId } from '../../data/repositories';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useSync } from '../../features/sync/syncStore';

/**
 * Fuel and maintenance are deliberately absent from this list.
 *
 * Both have their own richer entry screens, and both are projected into the
 * expense view automatically. Offering them here would let a user create a
 * second, unlinked copy of a cost they have already logged.
 */
const CATEGORIES: ExpenseCategory[] = [
  'insurance',
  'registration',
  'parking',
  'toll',
  'car_wash',
  'accessories',
  'financing',
  'fine',
  'inspection',
  'parts',
  'roadside_assistance',
  'other',
];

export default function NewExpenseScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const vehicle = useVehicles((state) => state.selected());
  const preferences = usePreferences((state) => state.preferences);
  const syncNow = useSync((state) => state.syncNow);

  const currency = preferences?.currency ?? 'USD';

  const [category, setCategory] = useState<ExpenseCategory>('parking');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = Boolean(vehicle) && parseNumeric(amount) > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit || !vehicle) return;
    setSaving(true);

    try {
      await expenseRepository.create({
        id: generateId(),
        vehicleId: vehicle.id,
        category,
        title: title.trim() || EXPENSE_CATEGORY_LABEL[category],
        amount: toMinorUnits(parseNumeric(amount), currency),
        currency,
        incurredAt: new Date().toISOString(),
        ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        source: 'manual',
      });

      router.back();
      snackbar.show({ message: 'Expense saved.', tone: 'success' });
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that expense',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFormScreen
      title="Add an expense"
      submitLabel="Save expense"
      canSubmit={canSubmit}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">Category</Text>
        <ChipGroup>
          {CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={EXPENSE_CATEGORY_LABEL[option]}
              variant="filter"
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </ChipGroup>
        <Text variant="bodySmall" color="onSurfaceVariant">
          Fuel and servicing have their own screens and are counted automatically.
        </Text>
      </View>

      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        required
        suffix={currency}
        leadingIcon="payments"
      />
      <TextField label="Description" value={title} onChangeText={setTitle} />
      <TextField label="Paid to" value={vendor} onChangeText={setVendor} leadingIcon="store" />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
    </RecordFormScreen>
  );
}
