import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DOCUMENT_TYPE_LABEL,
  evaluateDocuments,
  maskIdentifier,
  type DocumentEvaluation,
  type VehicleDocument,
} from '@carbuddy/domain';
import {
  Card,
  Chip,
  ChipGroup,
  Divider,
  EmptyState,
  ListItem,
  ListItemSkeleton,
  SkeletonGroup,
  StatusPill,
  Text,
  useTheme,
} from '../../design-system';
import { listDocuments } from '../../data/queries';
import { useSession } from '../../features/auth/sessionStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useFormatters } from '../../features/settings/useFormatters';

type Filter = 'all' | 'expiring' | 'vehicle' | 'driver';

/**
 * The document vault.
 *
 * Sorted by urgency rather than alphabetically, because the reason to open this
 * screen is almost always "when does something run out". Document numbers are
 * masked in the list — a policy number is exactly the kind of thing that should
 * not be readable over a shoulder — and revealed on the detail screen.
 */
export default function DocumentsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const format = useFormatters();

  const userId = useSession((state) => state.userId);
  const vehicleId = useVehicles((state) => state.selectedVehicleId);

  const [documents, setDocuments] = useState<VehicleDocument[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!userId) {
      setDocuments([]);
      return;
    }
    setDocuments(await listDocuments(userId, vehicleId ?? undefined));
  }, [userId, vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const evaluations = useMemo<Map<string, DocumentEvaluation>>(() => {
    if (!documents) return new Map();
    const now = new Date();
    return new Map(evaluateDocuments(documents, now).map((e) => [e.documentId, e]));
  }, [documents]);

  const visible = useMemo(() => {
    if (!documents) return [];
    const withEvaluation = documents
      .map((document) => ({ document, evaluation: evaluations.get(document.id) }))
      .filter((entry): entry is { document: VehicleDocument; evaluation: DocumentEvaluation } =>
        Boolean(entry.evaluation),
      );

    switch (filter) {
      case 'expiring':
        return withEvaluation.filter(
          (e) => e.evaluation.status === 'expiring_soon' || e.evaluation.status === 'expired',
        );
      case 'vehicle':
        return withEvaluation.filter((e) => e.document.vehicleId);
      case 'driver':
        return withEvaluation.filter((e) => !e.document.vehicleId);
      case 'all':
      default:
        return withEvaluation;
    }
  }, [documents, evaluations, filter]);

  const expiringCount = useMemo(
    () =>
      [...evaluations.values()].filter(
        (e) => e.status === 'expiring_soon' || e.status === 'expired',
      ).length,
    [evaluations],
  );

  if (!documents) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16 }}>
        <SkeletonGroup label="Loading your documents">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </SkeletonGroup>
      </ScrollView>
    );
  }

  if (documents.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top }}>
        <EmptyState
          icon="folder"
          title="Your document vault is empty"
          description="Keep registration, insurance, inspection certificates and your licence in one place — and get reminded well before any of them expire."
          actionLabel="Add a document"
          onAction={() => router.push('/documents/new')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 160,
        gap: 16,
      }}
    >
      <Text variant="displaySmall" accessibilityRole="header">
        Documents
      </Text>

      {expiringCount > 0 ? (
        <Card variant="filled" background={theme.colors.warningContainer}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onWarningContainer }}>
            {expiringCount} document{expiringCount === 1 ? '' : 's'} expiring soon or already
            expired.
          </Text>
        </Card>
      ) : null}

      <ChipGroup>
        <Chip
          label="All"
          variant="filter"
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <Chip
          label="Expiring"
          variant="filter"
          selected={filter === 'expiring'}
          onPress={() => setFilter('expiring')}
        />
        <Chip
          label="Vehicle"
          variant="filter"
          selected={filter === 'vehicle'}
          onPress={() => setFilter('vehicle')}
        />
        <Chip
          label="Driver"
          variant="filter"
          selected={filter === 'driver'}
          onPress={() => setFilter('driver')}
        />
      </ChipGroup>

      {visible.length === 0 ? (
        <EmptyState
          icon="filter-alt-off"
          title="Nothing matches that filter"
          description="Try a different filter to see your other documents."
          compact
        />
      ) : (
        <Card variant="filled" padding={4}>
          {visible.map(({ document, evaluation }, index) => (
            <React.Fragment key={document.id}>
              {index > 0 ? <Divider inset /> : null}
              <ListItem
                headline={document.title}
                overline={DOCUMENT_TYPE_LABEL[document.type]}
                supportingText={[
                  document.documentNumber
                    ? maskIdentifier(document.documentNumber, 'policy')
                    : null,
                  document.expiresAt ? format.date(document.expiresAt) : 'No expiry date',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                leadingIcon={document.vehicleId ? 'directions-car' : 'badge'}
                trailingContent={
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
                    label={
                      evaluation.status === 'expired'
                        ? 'Expired'
                        : evaluation.status === 'expiring_soon'
                          ? `${evaluation.daysRemaining}d`
                          : evaluation.status === 'no_expiry'
                            ? 'No date'
                            : 'Valid'
                    }
                    size="small"
                  />
                }
                onPress={() => router.push(`/documents/${document.id}`)}
              />
            </React.Fragment>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
