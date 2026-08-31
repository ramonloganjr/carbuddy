import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EXPENSE_CATEGORY_LABEL,
  formatMonthLabel,
  type DashboardViewModel,
} from '@carbuddy/domain';
import {
  BarChart,
  Card,
  CardSkeleton,
  ChartLegend,
  DonutChart,
  EmptyState,
  IconButton,
  LineChart,
  SegmentedButtons,
  SkeletonGroup,
  Text,
  TrendIndicator,
  useTheme,
  type DonutSegment,
} from '../../../design-system';
import { resolveDeepLink } from '../../../lib/deepLinks';
import { loadDashboard } from '../../../data/queries';
import { useSession } from '../../../features/auth/sessionStore';
import { usePreferences } from '../../../features/settings/preferencesStore';
import { useFormatters } from '../../../features/settings/useFormatters';

type Range = '6m' | '12m' | 'all';

/**
 * The analytics screen.
 *
 * Structured as answers to questions rather than as a grid of charts. Each
 * insight from the domain layer carries its own question, and that is the
 * heading it renders under — so the screen reads as "here is what your car
 * costs you" instead of "here is some data".
 */
export default function VehicleAnalyticsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();

  const userId = useSession((state) => state.userId);
  const economyStandard = usePreferences((state) => state.preferences?.economyStandard ?? 'km_l');

  const [data, setData] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('12m');

  const load = useCallback(async () => {
    if (!userId || !id) return;
    setData(await loadDashboard({ userId, vehicleId: id, economyStandard }));
    setLoading(false);
  }, [economyStandard, id, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const months = range === '6m' ? 6 : range === '12m' ? 12 : 1000;

  const expenseBars = (data?.expenses.byMonth ?? []).slice(-months).map((point) => ({
    label: formatMonthLabel(point.period).slice(0, 3),
    value: point.total,
    formattedValue: format.money(point.total),
  }));

  const economyPoints = (data?.monthlyFuel ?? [])
    .slice(-months)
    .filter((point) => point.efficiency.kilometres > 0)
    .map((point) => ({
      label: point.month.slice(5),
      value: Number(format.economyValue(point.efficiency)) || 0,
      formattedValue: format.economy(point.efficiency),
    }));

  /**
   * The donut palette.
   *
   * Drawn from the generated theme rather than a fixed list, so it stays
   * legible in dark mode and at higher contrast. Categories beyond the palette
   * are folded into "Other" rather than cycling colours, because a legend with
   * two visually identical swatches is worse than one honest bucket.
   */
  const categoryPalette = [
    theme.colors.primary,
    theme.colors.tertiary,
    theme.colors.secondary,
    theme.colors.warning,
    theme.colors.info,
    theme.colors.success,
  ];

  const categorySegments: DonutSegment[] = (() => {
    const categories = data?.expenses.byCategory ?? [];
    const top = categories.slice(0, categoryPalette.length);
    const rest = categories.slice(categoryPalette.length);
    const segments = top.map((category, index) => ({
      label: EXPENSE_CATEGORY_LABEL[category.category],
      value: category.total,
      color: categoryPalette[index] ?? theme.colors.outline,
    }));
    if (rest.length > 0) {
      segments.push({
        label: 'Other',
        value: rest.reduce((acc, category) => acc + category.total, 0),
        color: theme.colors.outline,
      });
    }
    return segments;
  })();

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
        <Text variant="displaySmall" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
          Your costs
        </Text>

        {loading ? (
          <SkeletonGroup label="Loading analytics">
            <CardSkeleton />
            <View style={{ height: 16 }} />
            <CardSkeleton />
          </SkeletonGroup>
        ) : !data || data.expenses.count === 0 ? (
          <EmptyState
            icon="insights"
            title="Nothing to analyse yet"
            description="Log a few fill-ups and any servicing, and this screen will start answering what your car actually costs to run."
            actionLabel="Log a fill-up"
            onAction={() => router.push('/fuel/new')}
          />
        ) : (
          <>
            <SegmentedButtons
              segments={[
                { value: '6m' as Range, label: '6 months' },
                { value: '12m' as Range, label: '12 months' },
                { value: 'all' as Range, label: 'All time' },
              ]}
              value={range}
              onChange={setRange}
              accessibilityLabel="Time range"
            />

            {/* ---- Headline figures ---- */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Metric label="Total spent" value={format.money(data.expenses.total)} />
              <Metric label="Per month" value={format.money(data.expenses.averagePerMonth)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Metric
                label={`Cost per ${format.distanceUnit}`}
                value={format.costPerDistance(data.costPerKm)}
              />
              <Metric label="Fuel share" value={`${data.expenses.fuelSharePercent}%`} />
            </View>

            {/* ---- Where the money goes ---- */}
            {categorySegments.length > 0 ? (
              <Card variant="filled">
                <View style={{ gap: 16 }}>
                  <Text variant="titleMedium">Where the money goes</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <DonutChart
                      segments={categorySegments}
                      size={140}
                      centerLabel={format.moneyCompact(data.expenses.total)}
                      centerSupportingText="total"
                      accessibilityLabel={`Spending by category. ${categorySegments
                        .map(
                          (s) =>
                            `${s.label} ${Math.round((s.value / data.expenses.total) * 100)} percent`,
                        )
                        .join(', ')}.`}
                    />
                    <View style={{ flex: 1 }}>
                      <ChartLegend segments={categorySegments} />
                    </View>
                  </View>
                </View>
              </Card>
            ) : null}

            {/* ---- Monthly spend ---- */}
            {expenseBars.length >= 2 ? (
              <Card variant="filled">
                <View style={{ gap: 16 }}>
                  <Text variant="titleMedium">Spending by month</Text>
                  <BarChart
                    data={expenseBars}
                    title="Monthly spending"
                    height={160}
                    highlightIndex={expenseBars.length - 1}
                  />
                  {data.expenses.highestMonth ? (
                    <Text variant="bodySmall" color="onSurfaceVariant">
                      Most expensive month: {formatMonthLabel(data.expenses.highestMonth.period)} at{' '}
                      {format.money(data.expenses.highestMonth.total)}.
                    </Text>
                  ) : null}
                </View>
              </Card>
            ) : null}

            {/* ---- Fuel economy ---- */}
            {economyPoints.length >= 2 ? (
              <Card variant="filled">
                <View style={{ gap: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="titleMedium" style={{ flex: 1 }}>
                      Fuel economy
                    </Text>
                    <TrendIndicator
                      changePercent={data.efficiencyTrend.changePercent}
                      direction={data.efficiencyTrend.direction}
                    />
                  </View>
                  <LineChart
                    data={economyPoints}
                    title={`Fuel economy in ${format.economyUnit}`}
                    valueUnit={format.economyUnit}
                    height={160}
                  />
                </View>
              </Card>
            ) : null}

            {/* ---- Questions answered ---- */}
            <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
              Your questions
            </Text>
            {data.insights.map((insight) => (
              <Card
                key={insight.id}
                variant="outlined"
                {...(insight.deepLink
                  ? {
                      onPress: () =>
                        router.push((resolveDeepLink(insight.deepLink) ?? '/(tabs)') as never),
                    }
                  : {})}
              >
                <View style={{ gap: 6 }}>
                  <Text variant="labelMedium" color="onSurfaceVariant">
                    {insight.question}
                  </Text>
                  {insight.amount !== undefined ? (
                    <Text variant="numericMedium">{format.money(Math.round(insight.amount))}</Text>
                  ) : insight.numeric !== undefined && insight.kind === 'ratio' ? (
                    <Text variant="numericMedium">{Math.round(insight.numeric)}%</Text>
                  ) : null}
                  <Text
                    variant="bodyMedium"
                    color={
                      insight.emphasis === 'positive'
                        ? 'success'
                        : insight.emphasis === 'negative'
                          ? 'error'
                          : 'onSurfaceVariant'
                    }
                  >
                    {insight.answer}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="filled" style={{ flex: 1 }} accessibilityLabel={`${label}: ${value}`}>
      <View style={{ gap: 4 }}>
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
