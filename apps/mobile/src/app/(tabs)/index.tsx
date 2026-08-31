import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Card,
  CardSkeleton,
  Chip,
  ChipGroup,
  CircularProgress,
  Divider,
  EmptyState,
  ListItem,
  ListItemSkeleton,
  OfflineBanner,
  SkeletonGroup,
  StatusPill,
  Text,
  TrendIndicator,
  useTheme,
} from '../../design-system';
import { resolveDeepLink } from '../../lib/deepLinks';
import { useDashboard } from '../../features/dashboard/useDashboard';
import { useFormatters } from '../../features/settings/useFormatters';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useSync } from '../../features/sync/syncStore';
import { VehicleSwitcher } from '../../features/vehicles/VehicleSwitcher';

/**
 * The home dashboard.
 *
 * Ordered by what someone actually opens the app to find out, most urgent
 * first: is anything wrong, what has this car cost me lately, and what is
 * coming up. Charts and deeper analytics sit a tap away on their own tabs —
 * this screen answers questions, it does not present a data warehouse.
 */
export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, reload } = useDashboard();
  const format = useFormatters();
  const vehicles = useVehicles((state) => state.vehicles);
  const syncStatus = useSync((state) => state.status);
  const syncNow = useSync((state) => state.syncNow);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow();
    await reload();
    setRefreshing(false);
  }, [reload, syncNow]);

  if (loading && !data) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 16 }}>
        <SkeletonGroup label="Loading your dashboard">
          <CardSkeleton />
          <View style={{ height: 16 }} />
          <CardSkeleton />
          <View style={{ height: 16 }} />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </SkeletonGroup>
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top }}>
        <EmptyState
          icon="directions-car"
          title="Add your first vehicle"
          description="Tell CarBuddy about your car and it will start tracking fuel, servicing, costs and document deadlines for you."
          actionLabel="Add a vehicle"
          onAction={() => router.push('/vehicle/new')}
        />
      </View>
    );
  }

  const { health, fuel, efficiencyTrend, fuelAnomaly } = data;

  return (
    <Animated.ScrollView
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 8,
        // Clears the navigation bar and the FAB above it.
        paddingBottom: insets.bottom + 160,
        gap: 16,
      }}
    >
      {vehicles.length > 0 ? <VehicleSwitcher /> : null}

      {syncStatus.state === 'offline' ? (
        <OfflineBanner pendingCount={syncStatus.pendingCount} />
      ) : null}

      {/* ---- Hero: vehicle identity and current mileage ---- */}
      <Card
        variant="filled"
        shape="extraExtraLarge"
        background={theme.colors.primaryContainer}
        padding={20}
        onPress={() => router.push(`/vehicle/${data.vehicleId}`)}
        accessibilityLabel={`${data.displayName}. ${format.distance(data.currentOdometerKm)} on the odometer. Open vehicle details.`}
      >
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="headlineMediumEmphasized"
                style={{ color: theme.colors.onPrimaryContainer }}
                numberOfLines={1}
              >
                {data.displayName}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
                numberOfLines={1}
              >
                {data.subtitle}
              </Text>
            </View>
            <MaterialIcons
              name="directions-car"
              size={36}
              color={theme.colors.onPrimaryContainer}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 24 }}>
            <HeroStat
              label="Odometer"
              value={format.distanceValue(data.currentOdometerKm)}
              unit={format.distanceUnit}
              color={theme.colors.onPrimaryContainer}
            />
            <HeroStat
              label="Average economy"
              value={format.economyValue(data.averageEfficiency)}
              unit={format.economyUnit}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
        </View>
      </Card>

      {/* ---- Health ---- */}
      <Card variant="filled" onPress={() => router.push(`/vehicle/${data.vehicleId}/health`)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <CircularProgress
            progress={health.score / 100}
            size={92}
            status={
              health.band === 'excellent' || health.band === 'good'
                ? 'ok'
                : health.band === 'attention'
                  ? 'due_soon'
                  : health.band === 'unknown'
                    ? 'unknown'
                    : 'overdue'
            }
            centerLabel={health.provisional ? '—' : String(health.score)}
            centerSupportingText={health.provisional ? undefined : 'of 100'}
            accessibilityLabel={
              health.provisional
                ? 'Vehicle health not yet available'
                : `Vehicle health ${health.score} out of 100. ${health.headline}`
            }
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="titleMedium">Vehicle health</Text>
            <Text variant="bodyMedium" color="onSurfaceVariant">
              {health.headline}
            </Text>
          </View>
        </View>
      </Card>

      {/* ---- This month ---- */}
      <View style={{ gap: 8 }}>
        <SectionHeading title="This month" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricTile
            label="Fuel"
            value={format.money(data.monthFuelCost)}
            icon="local-gas-station"
            onPress={() => router.push('/fuel')}
          />
          <MetricTile
            label="Servicing"
            value={format.money(data.monthMaintenanceCost)}
            icon="build"
            onPress={() => router.push('/maintenance')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricTile label="Distance" value={format.distance(data.monthDistanceKm)} icon="route" />
          <MetricTile
            label={`Cost per ${format.distanceUnit}`}
            value={format.costPerDistance(data.costPerKm)}
            icon="payments"
            onPress={() => router.push(`/vehicle/${data.vehicleId}/analytics`)}
          />
        </View>
      </View>

      {/* ---- Fuel economy trend ---- */}
      <Card variant="filled" onPress={() => router.push('/fuel')}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="titleMedium" style={{ flex: 1 }}>
              Fuel economy
            </Text>
            <TrendIndicator
              changePercent={efficiencyTrend.changePercent}
              direction={efficiencyTrend.direction}
            />
          </View>

          {fuel.measuredSegmentCount === 0 ? (
            <Text variant="bodyMedium" color="onSurfaceVariant">
              Log two full-tank fill-ups and CarBuddy can work out your real fuel economy.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <InlineStat label="Recent" value={format.economy(data.recentEfficiency)} />
              <InlineStat label="Lifetime" value={format.economy(data.averageEfficiency)} />
              {fuel.bestSegment ? (
                <InlineStat label="Best" value={format.economy(fuel.bestSegment.efficiency)} />
              ) : null}
            </View>
          )}

          {fuelAnomaly.severity !== 'none' && fuelAnomaly.direction === 'worse' ? (
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: 12,
                borderRadius: theme.shape.medium,
                backgroundColor: theme.colors.warningContainer,
              }}
            >
              <MaterialIcons
                name="info-outline"
                size={20}
                color={theme.colors.onWarningContainer}
              />
              <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onWarningContainer }}>
                Using about {Math.abs(Math.round(fuelAnomaly.deviationPercent))}% more fuel than
                usual lately. Tap to see what might explain it.
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      {/* ---- Needs attention ---- */}
      {data.upcomingMaintenance.length > 0 || data.expiringDocuments.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeading title="Needs attention" />
          <Card variant="filled" padding={4}>
            {data.upcomingMaintenance.map((item, index) => (
              <React.Fragment key={item.scheduleId}>
                {index > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={item.title}
                  supportingText={item.reason}
                  leadingIcon="build"
                  leadingIconBackground={theme.colors.surfaceContainerHighest}
                  leadingIconColor={theme.colors.onSurfaceVariant}
                  trailingContent={
                    <StatusPill
                      status={item.status}
                      label={statusLabel(item.status)}
                      size="small"
                    />
                  }
                  onPress={() => router.push(`/maintenance/${item.scheduleId}`)}
                />
              </React.Fragment>
            ))}

            {data.expiringDocuments.map((doc, index) => (
              <React.Fragment key={doc.documentId}>
                {index > 0 || data.upcomingMaintenance.length > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={doc.title}
                  supportingText={doc.reason}
                  leadingIcon="description"
                  leadingIconBackground={theme.colors.surfaceContainerHighest}
                  leadingIconColor={theme.colors.onSurfaceVariant}
                  trailingContent={
                    <StatusPill
                      status={doc.status === 'expired' ? 'overdue' : 'due_soon'}
                      label={doc.status === 'expired' ? 'Expired' : 'Soon'}
                      size="small"
                    />
                  }
                  onPress={() => router.push(`/documents/${doc.documentId}`)}
                />
              </React.Fragment>
            ))}
          </Card>
        </View>
      ) : (
        <Card variant="outlined">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MaterialIcons name="check-circle" size={24} color={theme.colors.success} />
            <Text variant="bodyLarge" style={{ flex: 1 }}>
              Nothing needs your attention right now.
            </Text>
          </View>
        </Card>
      )}

      {/* ---- Insights ---- */}
      {data.insights.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeading
            title="Your costs"
            actionLabel="See all"
            onAction={() => router.push(`/vehicle/${data.vehicleId}/analytics`)}
          />
          <ChipGroup>
            {data.insights.slice(0, 4).map((insight) => (
              <Chip
                key={insight.id}
                label={
                  insight.amount !== undefined
                    ? `${shortQuestion(insight.question)} · ${format.money(Math.round(insight.amount))}`
                    : shortQuestion(insight.question)
                }
                variant="suggestion"
                onPress={() =>
                  insight.deepLink &&
                  router.push((resolveDeepLink(insight.deepLink) ?? '/(tabs)') as never)
                }
              />
            ))}
          </ChipGroup>
        </View>
      ) : null}

      {/* ---- Recent activity ---- */}
      {data.recentActivity.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeading title="Recent activity" />
          <Card variant="filled" padding={4}>
            {data.recentActivity.slice(0, 5).map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={item.title}
                  supportingText={format.relativeDate(item.occurredAt)}
                  leadingIcon={
                    item.type === 'fuel'
                      ? 'local-gas-station'
                      : item.type === 'maintenance'
                        ? 'build'
                        : 'receipt-long'
                  }
                  trailingText={item.amount !== undefined ? format.money(item.amount) : undefined}
                  onPress={() =>
                    router.push((resolveDeepLink(item.deepLink) ?? '/(tabs)') as never)
                  }
                />
              </React.Fragment>
            ))}
          </Card>
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due':
      return 'Due';
    case 'due_soon':
      return 'Soon';
    default:
      return 'OK';
  }
}

/** Trim the question mark for chip labels, which read better as fragments. */
function shortQuestion(question: string): string {
  return question.replace(/\?$/, '');
}

function SectionHeading({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
      <Text variant="titleMedium" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Text variant="labelLarge" color="primary" onPress={onAction} accessibilityRole="button">
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function HeroStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="labelMedium" style={{ color, opacity: 0.8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text variant="numericLarge" style={{ color }}>
          {value}
        </Text>
        <Text variant="labelLarge" style={{ color, opacity: 0.8 }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="labelSmall" color="onSurfaceVariant">
        {label}
      </Text>
      <Text variant="numericSmall">{value}</Text>
    </View>
  );
}

function MetricTile({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      variant="filled"
      shape="extraLarge"
      padding={16}
      {...(onPress ? { onPress } : {})}
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1 }}
    >
      <View style={{ gap: 8 }}>
        <MaterialIcons name={icon} size={20} color={theme.colors.onSurfaceVariant} />
        <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="numericMedium" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Card>
  );
}
