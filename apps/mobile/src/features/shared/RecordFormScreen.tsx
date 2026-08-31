import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Text } from '../../design-system';

export interface RecordFormScreenProps {
  title: string;
  submitLabel: string;
  onSubmit: () => void;
  canSubmit: boolean;
  saving: boolean;
  children: React.ReactNode;
}

/**
 * Shared chrome for every "add a record" screen.
 *
 * All of them are the same shape: a close control, a title, a scrolling form,
 * and one large primary action pinned above the safe area. Factoring it out
 * keeps keyboard handling and submit placement identical everywhere — the sort
 * of thing that silently diverges when each screen builds its own.
 */
export function RecordFormScreen({
  title,
  submitLabel,
  onSubmit,
  canSubmit,
  saving,
  children,
}: RecordFormScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingTop: insets.top + 8,
          paddingHorizontal: 8,
          paddingBottom: 8,
        }}
      >
        <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
        <Text variant="titleLarge" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Button
          label={submitLabel}
          size="extraLarge"
          fullWidth
          loading={saving}
          disabled={!canSubmit}
          haptic="success"
          onPress={onSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/** Parse a user-typed number, tolerating currency symbols and separators. */
export function parseNumeric(value: string): number {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
