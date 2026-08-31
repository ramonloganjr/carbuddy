import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  averageDailyDistance,
  evaluateComponents,
  evaluateSchedules,
  MAINTENANCE_CATEGORY_LABEL,
  type ComponentEvaluation,
  type MaintenanceRecord,
  type ScheduleEvaluation,
} from '@carbuddy/domain';
import {
  Card,
  Divider,
  EmptyState,
  LinearProgress,
  ListItem,
  ListItemSkeleton,
  SegmentedButtons,
  SkeletonGroup,
  StatusPill,
  Text,
  useTheme,
} from '../../design-system';
import {
  listComponents,
  listFuelRecords,
  listMaintenanceRecords,
  listSchedules,
} from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useFormatters } from '../../features/settings/useFormatters';

type Tab = 'upcoming' | 'history' | 'parts';

const TABS = [
  { value: 'upcoming' as const, label: 'Upcoming' },
  { value: 'history' as const, label: 'History' },
  { value: 'parts' as const, label: 'Parts' },
];

interface MaintenanceData {
  schedules: ScheduleEvaluation[];
  components: ComponentEvaluation[];
  records: MaintenanceRecord[];
}

export default function MaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const format = useFormatters();
  const vehicle = useVehicles((state) => state.selected());
  const [tab, setTab] = useState<Tab>('upcoming');
  const [data, setData] = useState<MaintenanceData | null>(null);

  const load = useCallback(async () => {
    if (!vehicle) {
      setData({ schedules: [], components: [], records: [] });
      return;
    }

    const [schedules, components, records, fuelRecords] = await Promise.all([
      listSchedules(vehicle.id),
      listComponents(vehicle.id),
      listMaintenanceRecords(vehicle.id),
      listFuelRecords(vehicle.id),
    ]);

    // Driving habits from the fuel log turn "3,200 km away" into "about five
    // weeks away", which is what people actually plan around.
    const context = {
      now: new Date(),
      currentOdometerKm: vehicle.currentOdometerKm,
      averageDailyDistanceKm: averageDailyDistance(fuelRecords),
    };

    setData({
      schedules: evaluateSchedules(schedules, context),
      components: evaluateComponents(components, context),
      records,
    });
  }, [vehicle]);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(
    () => data?.schedules.filter((s) => s.status !== 'ok' && s.status !== 'unknown') ?? [],
    [data],
  );

  if (!data) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16 }}>
        <SkeletonGroup label="Loading your service records">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </SkeletonGroup>
      </ScrollView>
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
        Service
      </Text>

      <SegmentedButtons
        segments={TABS}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Service view"
      />

      {tab === 'upcoming' ? (
        data.schedules.length === 0 ? (
          <EmptyState
            icon="build"
            title="No service schedule yet"
            description="Set up reminders for oil changes, filters, brakes and inspections. CarBuddy tracks both time and mileage and warns you on whichever comes first."
            actionLabel="Set up reminders"
            onAction={() => router.push('/maintenance/schedules')}
            compact
          />
        ) : (
          <View style={{ gap: 12 }}>
            {attention.length > 0 ? (
              <Card variant="filled" padding={4}>
                {attention.map((item, index) => (
                  <React.Fragment key={item.scheduleId}>
                    {index > 0 ? <Divider inset /> : null}
                    <ScheduleRow
                      item={item}
                      onPress={() => router.push(`/maintenance/${item.scheduleId}`)}
                    />
                  </React.Fragment>
                ))}
              </Card>
            ) : (
              <Card variant="outlined">
                <Text variant="bodyLarge">Everything is up to date. Nothing due right now.</Text>
              </Card>
            )}

            <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
              All schedules
            </Text>
            <Card variant="filled" padding={4}>
              {data.schedules.map((item, index) => (
                <React.Fragment key={item.scheduleId}>
                  {index > 0 ? <Divider inset /> : null}
                  <ScheduleRow
                    item={item}
                    onPress={() => router.push(`/maintenance/${item.scheduleId}`)}
                  />
                </React.Fragment>
              ))}
            </Card>
          </View>
        )
      ) : null}

      {tab === 'history' ? (
        data.records.length === 0 ? (
          <EmptyState
            icon="history"
            title="No service history yet"
            description="Log every service and repair. A complete history helps with warranty claims and is worth real money at resale."
            actionLabel="Log a service"
            onAction={() => router.push('/maintenance/new')}
            compact
          />
        ) : (
          <Card variant="filled" padding={4}>
            {data.records.map((record, index) => (
              <React.Fragment key={record.id}>
                {index > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={record.title ?? MAINTENANCE_CATEGORY_LABEL[record.category]}
                  overline={format.date(record.servicedAt)}
                  supportingText={[record.providerName, format.distance(record.odometerKm)]
                    .filter(Boolean)
                    .join(' · ')}
                  leadingIcon="build"
                  trailingText={format.money(record.totalCost)}
                  onPress={() => router.push(`/maintenance/record/${record.id}`)}
                />
              </React.Fragment>
            ))}
          </Card>
        )
      ) : null}

      {tab === 'parts' ? (
        data.components.length === 0 ? (
          <EmptyState
            icon="tire-repair"
            title="No parts tracked yet"
            description="Track tyres, battery, brake pads and filters to see how much life each has left and what they really cost per kilometre."
            actionLabel="Add a part"
            onAction={() => router.push('/components/new')}
            compact
          />
        ) : (
          <View style={{ gap: 12 }}>
            {data.components.map((component) => (
              <Card
                key={component.componentId}
                variant="filled"
                onPress={() => router.push(`/components/${component.componentId}`)}
              >
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="titleMedium" style={{ flex: 1 }}>
                      {component.label}
                    </Text>
                    <StatusPill
                      status={component.status}
                      label={
                        component.status === 'overdue'
                          ? 'Replace'
                          : component.status === 'due'
                            ? 'Due'
                            : component.status === 'due_soon'
                              ? 'Soon'
                              : component.status === 'unknown'
                                ? 'Not tracked'
                                : 'Good'
                      }
                      size="small"
                    />
                  </View>

                  <LinearProgress
                    progress={component.wear}
                    status={component.status}
                    label={component.reason}
                    accessibilityLabel={`${component.label}: ${Math.round(component.wear * 100)} percent of expected life used. ${component.reason}`}
                  />

                  {component.usingDefaultLife ? (
                    <Text variant="bodySmall" color="onSurfaceVariant">
                      Based on a typical service life — set your own for a better estimate.
                    </Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

function ScheduleRow({ item, onPress }: { item: ScheduleEvaluation; onPress: () => void }) {
  const theme = useTheme();
  return (
    <ListItem
      headline={item.title}
      supportingText={item.reason}
      leadingIcon="build"
      leadingIconBackground={theme.colors.surfaceContainerHighest}
      leadingIconColor={theme.colors.onSurfaceVariant}
      trailingContent={
        <StatusPill
          status={item.status}
          label={
            item.status === 'overdue'
              ? 'Overdue'
              : item.status === 'due'
                ? 'Due'
                : item.status === 'due_soon'
                  ? 'Soon'
                  : item.status === 'unknown'
                    ? 'Not set'
                    : 'OK'
          }
          size="small"
        />
      }
      onPress={onPress}
    />
  );
}
