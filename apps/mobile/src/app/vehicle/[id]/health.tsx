import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { EFFICIENCY_FACTOR_COPY, type DashboardViewModel } from '@carbuddy/domain';
import {
  Card,
  CardSkeleton,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  ListItem,
  SkeletonGroup,
  StatusPill,
  Text,
  useTheme,
} from '../../../design-system';
import { loadDashboard } from '../../../data/queries';
import { useSession } from '../../../features/auth/sessionStore';
import { usePreferences } from '../../../features/settings/preferencesStore';

/**
 * Vehicle health, broken down.
 *
 * The headline number is never presented alone — each contributing dimension
 * gets its own score, plain-language summary and a route to act on it. A bare
 * "72" is not actionable, and it would fail the same "colour is not enough"
 * standard the rest of the app holds itself to.
 */
export default function VehicleHealthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const userId = useSession((state) => state.userId);
  const economyStandard = usePreferences((state) => state.preferences?.economyStandard ?? 'km_l');

  const [data, setData] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !id) return;
    setData(await loadDashboard({ userId, vehicleId: id, economyStandard }));
    setLoading(false);
  }, [economyStandard, id, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const anomaly = data?.fuelAnomaly;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingHorizontal: 8,
          paddingBottom: 8,
        }}
      >
        <IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        {loading || !data ? (
          <SkeletonGroup label="Loading vehicle health">
            <CardSkeleton />
          </SkeletonGroup>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
              <CircularProgress
                progress={data.health.score / 100}
                size={160}
                strokeWidth={14}
                status={
                  data.health.band === 'excellent' || data.health.band === 'good'
                    ? 'ok'
                    : data.health.band === 'attention'
                      ? 'due_soon'
                      : data.health.band === 'unknown'
                        ? 'unknown'
                        : 'overdue'
                }
                centerLabel={data.health.provisional ? '—' : String(data.health.score)}
                centerSupportingText={data.health.provisional ? 'not enough data' : 'of 100'}
                accessibilityLabel={
                  data.health.provisional
                    ? 'Vehicle health not yet available'
                    : `Vehicle health ${data.health.score} out of 100. ${data.health.headline}`
                }
              />
              <Text variant="titleLarge" align="center">
                {data.health.headline}
              </Text>
            </View>

            {data.health.factors.map((factor) => (
              <Card key={factor.id} variant="filled">
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="titleMedium" style={{ flex: 1 }}>
                      {factor.label}
                    </Text>
                    <StatusPill
                      status={
                        factor.band === 'unknown'
                          ? 'unknown'
                          : factor.band === 'excellent' || factor.band === 'good'
                            ? 'ok'
                            : factor.band === 'attention'
                              ? 'due_soon'
                              : 'overdue'
                      }
                      label={factor.band === 'unknown' ? 'Not tracked' : `${factor.score}`}
                      size="small"
                    />
                  </View>

                  {factor.band !== 'unknown' ? (
                    <LinearProgress
                      progress={factor.score / 100}
                      status={
                        factor.score >= 75 ? 'ok' : factor.score >= 50 ? 'due_soon' : 'overdue'
                      }
                      accessibilityLabel={`${factor.label}: ${factor.score} out of 100`}
                      height={6}
                    />
                  ) : null}

                  <Text variant="bodyMedium" color="onSurfaceVariant">
                    {factor.summary}
                  </Text>
                </View>
              </Card>
            ))}

            {/* ---- Fuel insight ---- */}
            {anomaly && anomaly.factors.length > 0 ? (
              <>
                <Text
                  variant="titleMedium"
                  style={{ paddingHorizontal: 4 }}
                  accessibilityRole="header"
                >
                  Worth checking
                </Text>
                <Card variant="outlined">
                  <View style={{ gap: 12 }}>
                    <Text variant="bodyMedium">
                      Your recent fuel economy is about{' '}
                      {Math.abs(Math.round(anomaly.deviationPercent))}% worse than this vehicle's
                      usual. These are things that commonly explain that — not a diagnosis.
                    </Text>
                    <Divider />
                    {anomaly.factors.map((factorKey) => {
                      const copy = EFFICIENCY_FACTOR_COPY[factorKey];
                      return (
                        <View key={factorKey} style={{ gap: 2 }}>
                          <Text variant="titleSmall">{copy.title}</Text>
                          <Text variant="bodySmall" color="onSurfaceVariant">
                            {copy.body}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </>
            ) : null}

            {/* ---- What to do ---- */}
            {data.upcomingMaintenance.length > 0 || data.expiringDocuments.length > 0 ? (
              <>
                <Text
                  variant="titleMedium"
                  style={{ paddingHorizontal: 4 }}
                  accessibilityRole="header"
                >
                  What needs doing
                </Text>
                <Card variant="filled" padding={4}>
                  {data.upcomingMaintenance.map((item, index) => (
                    <React.Fragment key={item.scheduleId}>
                      {index > 0 ? <Divider inset /> : null}
                      <ListItem
                        headline={item.title}
                        supportingText={item.reason}
                        leadingIcon="build"
                        showChevron
                        onPress={() => router.push(`/maintenance/${item.scheduleId}`)}
                      />
                    </React.Fragment>
                  ))}
                  {data.expiringDocuments.map((doc) => (
                    <React.Fragment key={doc.documentId}>
                      <Divider inset />
                      <ListItem
                        headline={doc.title}
                        supportingText={doc.reason}
                        leadingIcon="description"
                        showChevron
                        onPress={() => router.push(`/documents/${doc.documentId}`)}
                      />
                    </React.Fragment>
                  ))}
                </Card>
              </>
            ) : (
              <Card variant="outlined">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <MaterialIcons name="check-circle" size={24} color={theme.colors.success} />
                  <Text variant="bodyLarge" style={{ flex: 1 }}>
                    Nothing needs doing right now.
                  </Text>
                </View>
              </Card>
            )}

            <Text variant="bodySmall" color="onSurfaceVariant" style={{ paddingHorizontal: 4 }}>
              This score reflects what you have logged, not a mechanical inspection. A car with an
              empty log is not an unhealthy car.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
