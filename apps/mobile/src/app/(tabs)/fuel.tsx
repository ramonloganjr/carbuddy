import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  analyseConsumption,
  computeFuelStatistics,
  efficiencyAs,
  monthlyFuelSeries,
  type FuelRecord,
} from '@carbuddy/domain';
import {
  Card,
  Divider,
  EmptyState,
  LineChart,
  ListItem,
  ListItemSkeleton,
  SegmentedButtons,
  SkeletonGroup,
  Text,
  useTheme,
} from '../../design-system';
import { listFuelRecords } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { usePreferences } from '../../features/settings/preferencesStore';

type Range = '6m' | '12m' | 'all';

const RANGE_SEGMENTS = [
  { value: '6m' as const, label: '6 months' },
  { value: '12m' as const, label: '12 months' },
  { value: 'all' as const, label: 'All' },
];

/**
 * The fuel log.
 *
 * Progressive disclosure in practice: the summary and one trend line sit at the
 * top, and the detail is the list underneath. Someone who just wants to know
 * "am I doing better or worse" gets that in the first screenful without
 * scrolling into a wall of numbers.
 */
export default function FuelScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const format = useFormatters();

  const vehicleId = useVehicles((state) => state.selectedVehicleId);
  const economyStandard = usePreferences((state) => state.preferences?.economyStandard ?? 'km_l');

  const [records, setRecords] = useState<FuelRecord[] | null>(null);
  const [range, setRange] = useState<Range>('6m');

  const load = useCallback(async () => {
    if (!vehicleId) {
      setRecords([]);
      return;
    }
    setRecords(await listFuelRecords(vehicleId));
  }, [vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analysis = useMemo(() => {
    if (!records) return null;
    const stats = computeFuelStatistics(records);
    const { segments } = analyseConsumption(records);
    const monthly = monthlyFuelSeries(records);

    const months = range === '6m' ? 6 : range === '12m' ? 12 : monthly.length;
    const windowed = monthly.slice(-months);

    return {
      stats,
      segments,
      chartPoints: windowed
        .filter((point) => point.efficiency.kilometres > 0)
        .map((point) => ({
          label: point.month.slice(5),
          value: Number((efficiencyAs(point.efficiency, economyStandard) ?? 0).toFixed(1)),
          formattedValue: format.economy(point.efficiency),
        })),
    };
  }, [economyStandard, format, range, records]);

  if (!records) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16 }}>
        <SkeletonGroup label="Loading your fuel log">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </SkeletonGroup>
      </ScrollView>
    );
  }

  if (records.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top }}>
        <EmptyState
          icon="local-gas-station"
          title="No fill-ups yet"
          description="Log a fill-up each time you refuel. After the second full tank, CarBuddy can work out your real fuel economy and running cost."
          actionLabel="Log a fill-up"
          onAction={() => router.push('/fuel/new')}
        />
      </View>
    );
  }

  const stats = analysis?.stats;

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
        Fuel
      </Text>

      {/* ---- Summary ---- */}
      {stats ? (
        <Card variant="filled">
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
              <SummaryStat
                label="Average economy"
                value={format.economy(stats.averageEfficiency)}
                width="50%"
              />
              <SummaryStat label="Total spent" value={format.money(stats.totalCost)} width="50%" />
              <SummaryStat label="Fuel used" value={format.volume(stats.totalLitres)} width="50%" />
              <SummaryStat
                label={`Fuel per ${format.distanceUnit}`}
                value={format.costPerDistance(stats.fuelCostPerKm)}
                width="50%"
              />
            </View>

            {stats.measuredSegmentCount === 0 ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: theme.shape.medium,
                  backgroundColor: theme.colors.surfaceContainerHighest,
                }}
              >
                <Text variant="bodySmall" color="onSurfaceVariant">
                  Fuel economy needs two full-tank fill-ups in a row. Partial fills still count
                  toward your spending.
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* ---- Trend ---- */}
      {analysis && analysis.chartPoints.length >= 2 ? (
        <Card variant="filled">
          <View style={{ gap: 16 }}>
            <Text variant="titleMedium">Economy over time</Text>
            <SegmentedButtons
              segments={RANGE_SEGMENTS}
              value={range}
              onChange={setRange}
              accessibilityLabel="Time range"
            />
            <LineChart
              data={analysis.chartPoints}
              title={`Fuel economy in ${format.economyUnit}`}
              valueUnit={format.economyUnit}
              height={160}
            />
          </View>
        </Card>
      ) : null}

      {/* ---- Best and worst ---- */}
      {stats?.bestSegment && stats.worstSegment ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card variant="outlined" style={{ flex: 1 }}>
            <View style={{ gap: 4 }}>
              <Text variant="labelMedium" color="success">
                Best tank
              </Text>
              <Text variant="numericSmall">{format.economy(stats.bestSegment.efficiency)}</Text>
              <Text variant="bodySmall" color="onSurfaceVariant">
                {format.date(stats.bestSegment.endedAt)}
              </Text>
            </View>
          </Card>
          <Card variant="outlined" style={{ flex: 1 }}>
            <View style={{ gap: 4 }}>
              <Text variant="labelMedium" color="error">
                Worst tank
              </Text>
              <Text variant="numericSmall">{format.economy(stats.worstSegment.efficiency)}</Text>
              <Text variant="bodySmall" color="onSurfaceVariant">
                {format.date(stats.worstSegment.endedAt)}
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      {/* ---- Log ---- */}
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
          Fill-up history
        </Text>
        <Card variant="filled" padding={4}>
          {records.map((record, index) => {
            const segment = analysis?.segments.find((s) => s.toRecordId === record.id);
            return (
              <React.Fragment key={record.id}>
                {index > 0 ? <Divider inset /> : null}
                <ListItem
                  headline={record.stationName ?? 'Fill-up'}
                  overline={format.date(record.filledAt)}
                  supportingText={[
                    format.volume(record.litres),
                    format.distance(record.odometerKm),
                    record.isFullTank ? 'Full tank' : 'Partial fill',
                    segment ? format.economy(segment.efficiency) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  leadingIcon="local-gas-station"
                  trailingText={format.money(record.totalCost)}
                  onPress={() => router.push(`/fuel/${record.id}`)}
                />
              </React.Fragment>
            );
          })}
        </Card>
      </View>
    </ScrollView>
  );
}

function SummaryStat({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: `${number}%`;
}) {
  return (
    <View style={{ width, gap: 2 }}>
      <Text variant="labelMedium" color="onSurfaceVariant">
        {label}
      </Text>
      <Text variant="numericSmall" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
