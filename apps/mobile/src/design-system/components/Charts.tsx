import React, { useMemo, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { SHAPE } from '../tokens/shape';
import { withAlpha } from '../tokens/colors';

export interface ChartPoint {
  /** Short axis label, e.g. `Mar` or `12/03`. */
  label: string;
  value: number;
  /** Optional pre-formatted value for the accessible description. */
  formattedValue?: string;
}

interface BaseChartProps {
  data: readonly ChartPoint[];
  height?: number;
  /** What the chart is *about*, e.g. "Fuel economy over the last 6 months". */
  title: string;
  /** Unit for spoken values, e.g. "kilometres per litre". */
  valueUnit?: string;
  style?: ViewStyle;
}

/**
 * Build the spoken description of a chart.
 *
 * A chart is invisible to a screen reader, so every chart in this app ships
 * with a sentence that carries the same information the picture does: the
 * range, the direction, and where the extremes sit. That is the difference
 * between an accessible chart and one that merely has a label — and it is
 * genuinely useful sighted-user copy too, which is why it also renders as the
 * caption beneath each chart.
 */
export function describeSeries(title: string, data: readonly ChartPoint[], valueUnit = ''): string {
  if (data.length === 0) return `${title}. No data yet.`;
  if (data.length === 1) {
    const only = data[0]!;
    return `${title}. One data point: ${only.label}, ${only.formattedValue ?? only.value}${valueUnit ? ` ${valueUnit}` : ''}.`;
  }

  const values = data.map((d) => d.value);
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const max = data[values.indexOf(Math.max(...values))]!;
  const min = data[values.indexOf(Math.min(...values))]!;

  const change =
    first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100;
  const direction =
    change === null
      ? 'changed'
      : change > 5
        ? 'risen'
        : change < -5
          ? 'fallen'
          : 'stayed roughly level';

  const unit = valueUnit ? ` ${valueUnit}` : '';

  return (
    `${title}. ${data.length} points from ${first.label} to ${last.label}. ` +
    `Values have ${direction}${change !== null && Math.abs(change) > 5 ? ` by ${Math.abs(Math.round(change))} percent` : ''}, ` +
    `from ${first.formattedValue ?? first.value}${unit} to ${last.formattedValue ?? last.value}${unit}. ` +
    `Highest ${max.formattedValue ?? max.value}${unit} in ${max.label}, lowest ${min.formattedValue ?? min.value}${unit} in ${min.label}.`
  );
}

/**
 * Line chart for trends over time.
 *
 * Deliberately spare: no gridlines beyond a baseline, no axis furniture, no
 * decorative gradients competing with the data. Charts in this product exist to
 * answer a question, not to fill space, so anything that is not the trend
 * itself is removed.
 */
export function LineChart({
  data,
  height = 180,
  title,
  valueUnit,
  showArea = true,
  style,
}: BaseChartProps & { showArea?: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (data.length < 2 || width === 0) return null;

    const paddingX = 8;
    const paddingY = 16;
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    // A flat series would divide by zero; give it a nominal band so the line
    // renders through the middle instead of collapsing onto the axis.
    const range = max - min || Math.abs(max) || 1;

    const points = data.map((point, index) => ({
      x: paddingX + (index / (data.length - 1)) * innerWidth,
      y: paddingY + (1 - (point.value - min) / range) * innerHeight,
      point,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');

    const areaPath = `${linePath} L${points[points.length - 1]!.x.toFixed(2)},${height - paddingY} L${points[0]!.x.toFixed(2)},${height - paddingY} Z`;

    return { points, linePath, areaPath, paddingY };
  }, [data, height, width]);

  const description = describeSeries(title, data, valueUnit);
  const active = selected !== null ? data[selected] : null;

  return (
    <View style={[{ gap: 8 }, style as ViewStyle]}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={description}
        style={{ height }}
      >
        {geometry ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.25} />
                <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {showArea ? <Path d={geometry.areaPath} fill="url(#areaFill)" /> : null}

            <Path
              d={geometry.linePath}
              stroke={theme.colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {geometry.points.map((p, index) => (
              <Circle
                key={`${p.point.label}-${index}`}
                cx={p.x}
                cy={p.y}
                r={selected === index ? 6 : 3.5}
                fill={selected === index ? theme.colors.primary : theme.colors.surface}
                stroke={theme.colors.primary}
                strokeWidth={2}
              />
            ))}

            {selected !== null && geometry.points[selected] ? (
              <Line
                x1={geometry.points[selected]!.x}
                y1={geometry.paddingY}
                x2={geometry.points[selected]!.x}
                y2={height - geometry.paddingY}
                stroke={withAlpha(theme.colors.onSurface, 0.2)}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}
          </Svg>
        ) : null}
      </View>

      {/* Tappable strips give a touch target per point without covering the line. */}
      {geometry ? (
        <View
          style={{ flexDirection: 'row', marginTop: -height, height, opacity: 0 }}
          pointerEvents="box-none"
        >
          {data.map((point, index) => (
            <Pressable
              key={`${point.label}-${index}`}
              onPress={() => setSelected(selected === index ? null : index)}
              haptic="selection"
              shape="none"
              ensureTouchTarget={false}
              accessibilityLabel={`${point.label}, ${point.formattedValue ?? point.value}`}
              style={{ flex: 1, height }}
            >
              <View />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="labelSmall" color="onSurfaceVariant">
          {data[0]?.label ?? ''}
        </Text>
        {active ? (
          <Text variant="labelMedium" color="primary">
            {active.label}: {active.formattedValue ?? active.value}
          </Text>
        ) : null}
        <Text variant="labelSmall" color="onSurfaceVariant">
          {data[data.length - 1]?.label ?? ''}
        </Text>
      </View>
    </View>
  );
}

/** Bar chart for monthly totals. */
export function BarChart({
  data,
  height = 180,
  title,
  valueUnit,
  highlightIndex,
  style,
}: BaseChartProps & { highlightIndex?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const max = Math.max(...data.map((d) => d.value), 1);
  const barGap = 6;
  const barWidth =
    data.length > 0 ? Math.max(4, (width - barGap * (data.length - 1)) / data.length) : 0;

  return (
    <View style={[{ gap: 8 }, style as ViewStyle]}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={describeSeries(title, data, valueUnit)}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <G>
              {data.map((point, index) => {
                const barHeight = Math.max(2, (point.value / max) * (height - 8));
                const isHighlighted = highlightIndex === index;
                return (
                  <Rect
                    key={`${point.label}-${index}`}
                    x={index * (barWidth + barGap)}
                    y={height - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(barWidth / 2, 8)}
                    fill={isHighlighted ? theme.colors.primary : theme.colors.primaryContainer}
                  />
                );
              })}
            </G>
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.map((point, index) =>
          // Label every bar when there are few, otherwise only the ends.
          data.length <= 6 || index === 0 || index === data.length - 1 ? (
            <Text key={`${point.label}-${index}`} variant="labelSmall" color="onSurfaceVariant">
              {point.label}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut chart for the expense category split.
 *
 * Always rendered alongside its legend, which carries the label, the value and
 * the share as text. The ring is the summary; the legend is the data. Nobody
 * has to distinguish eight colours to read it.
 */
export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 28,
  centerLabel,
  centerSupportingText,
  accessibilityLabel,
}: {
  segments: readonly DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSupportingText?: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceContainerHighest}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0
          ? segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = circumference * fraction;
              const element = (
                <Circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  fill="none"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += dash;
              return element;
            })
          : null}
      </Svg>

      <View style={{ alignItems: 'center' }}>
        {centerLabel ? <Text variant="numericMedium">{centerLabel}</Text> : null}
        {centerSupportingText ? (
          <Text variant="labelSmall" color="onSurfaceVariant">
            {centerSupportingText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ChartLegend({ segments }: { segments: readonly DonutSegment[] }) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);

  return (
    <View style={{ gap: 8 }}>
      {segments.map((segment) => {
        const share = total > 0 ? Math.round((segment.value / total) * 100) : 0;
        return (
          <View
            key={segment.label}
            accessible
            accessibilityLabel={`${segment.label}, ${share} percent`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: SHAPE.extraSmall,
                backgroundColor: segment.color,
              }}
            />
            <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
              {segment.label}
            </Text>
            <Text variant="labelLarge" color="onSurfaceVariant">
              {share}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}
