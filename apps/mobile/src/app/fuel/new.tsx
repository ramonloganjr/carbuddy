import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  analyseConsumption,
  fromKilometres,
  makeEfficiency,
  toKilometres,
  toLitres,
  toMinorUnits,
  validateOdometerReading,
  type FuelRecord,
} from '@carbuddy/domain';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  IconButton,
  Text,
  TextField,
  useSnackbar,
  useTheme,
} from '../../design-system';
import {
  fuelRepository,
  generateId,
  odometerRepository,
  vehicleRepository,
} from '../../data/repositories';
import { listFuelRecords } from '../../data/queries';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { usePreferences } from '../../features/settings/preferencesStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { useSync } from '../../features/sync/syncStore';

/**
 * Log a fill-up.
 *
 * The highest-frequency write in the app, and usually performed standing at a
 * pump in the rain, so the design is aggressive about reducing typing:
 *
 *   - The odometer is pre-filled with the last known reading.
 *   - Entering any two of volume / unit price / total computes the third.
 *   - Full tank is on by default, because most fills are.
 *   - A live preview shows the economy this entry will produce, so a mistyped
 *     odometer is obvious *before* saving rather than after it has skewed the
 *     averages.
 *
 * Everything is entered in the user's units and converted at this boundary; the
 * domain and database only ever see kilometres, litres and minor units.
 */
export default function NewFuelRecordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();

  const vehicle = useVehicles((state) => state.selected());
  const loadVehicles = useVehicles((state) => state.load);
  const preferences = usePreferences((state) => state.preferences);
  const syncNow = useSync((state) => state.syncNow);

  const distanceUnit = preferences?.distanceUnit ?? 'km';
  const volumeUnit = preferences?.volumeUnit ?? 'l';
  const currency = preferences?.currency ?? 'USD';
  const volumeLabel = volumeUnit === 'l' ? 'L' : 'gal';

  const [odometer, setOdometer] = useState('');
  const [volume, setVolume] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [total, setTotal] = useState('');
  const [station, setStation] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [missedFill, setMissedFill] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [previous, setPrevious] = useState<FuelRecord[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    void listFuelRecords(vehicle.id).then(setPrevious);
    setOdometer(String(Math.round(fromKilometres(vehicle.currentOdometerKm, distanceUnit))));
  }, [distanceUnit, vehicle]);

  const numeric = (value: string) => {
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /**
   * Fill in whichever of volume / price / total the user left blank.
   *
   * Pump receipts show all three, but people type whichever two are easiest to
   * read. Computing the third removes a step without ever overwriting a value
   * that was entered deliberately.
   */
  const completeAmounts = (changed: 'volume' | 'price' | 'total', value: string) => {
    const v = changed === 'volume' ? numeric(value) : numeric(volume);
    const p = changed === 'price' ? numeric(value) : numeric(unitPrice);
    const t = changed === 'total' ? numeric(value) : numeric(total);

    if (changed !== 'total' && v > 0 && p > 0) {
      setTotal((v * p).toFixed(2));
      return;
    }
    if (changed !== 'price' && v > 0 && t > 0) {
      setUnitPrice((t / v).toFixed(3));
      return;
    }
    if (changed !== 'volume' && p > 0 && t > 0) {
      setVolume((t / p).toFixed(2));
    }
  };

  const odometerKm = toKilometres(numeric(odometer), distanceUnit);
  const litres = toLitres(numeric(volume), volumeUnit);

  const odometerCheck = useMemo(() => {
    const lastKnown =
      previous.length > 0
        ? Math.max(...previous.map((r) => r.odometerKm))
        : (vehicle?.currentOdometerKm ?? null);
    return validateOdometerReading(odometerKm, lastKnown);
  }, [odometerKm, previous, vehicle]);

  /**
   * Live economy preview.
   *
   * Runs the real consumption engine against the existing log plus this
   * pending entry, so the number shown is exactly the number that will be
   * saved — not an approximation computed a second way.
   */
  const preview = useMemo(() => {
    if (!vehicle || !isFullTank || litres <= 0 || odometerKm <= 0) return null;

    const draft: FuelRecord = {
      id: 'draft',
      vehicleId: vehicle.id,
      filledAt: new Date().toISOString(),
      odometerKm,
      litres,
      totalCost: toMinorUnits(numeric(total), currency),
      currency,
      fuelType: 'gasoline',
      isFullTank: true,
      missedFill,
    };

    const { segments } = analyseConsumption([...previous, draft]);
    const closing = segments.find((segment) => segment.toRecordId === 'draft');
    if (!closing) return null;

    return {
      efficiency: makeEfficiency(closing.distanceKm, closing.litres),
      distanceKm: closing.distanceKm,
    };
  }, [currency, isFullTank, litres, missedFill, odometerKm, previous, total, vehicle]);

  const canSubmit =
    Boolean(vehicle) && numeric(volume) > 0 && numeric(total) > 0 && odometerCheck.valid && !saving;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit || !vehicle) return;
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const recordId = generateId();

      await fuelRepository.create({
        id: recordId,
        vehicleId: vehicle.id,
        filledAt: now,
        odometerKm,
        litres,
        totalCost: toMinorUnits(numeric(total), currency),
        currency,
        fuelType: 'gasoline',
        isFullTank,
        missedFill,
        ...(station.trim() ? { stationName: station.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      // A fill-up is also an odometer observation. Recording it keeps mileage
      // projections accurate without asking the user to enter it twice.
      await odometerRepository.create({
        id: generateId(),
        vehicleId: vehicle.id,
        odometerKm,
        recordedAt: now,
        source: 'fuel_record',
        sourceId: recordId,
      });

      if (odometerKm > vehicle.currentOdometerKm) {
        await vehicleRepository.update(vehicle.id, {
          current_odometer_km: odometerKm,
          odometer_updated_at: now,
        });
        await loadVehicles(vehicle.userId);
      }

      router.back();
      snackbar.show({
        message: preview
          ? `Saved — ${format.economy(preview.efficiency)} on that tank.`
          : 'Fill-up saved.',
        tone: 'success',
      });

      // Fire and forget: the record is already safe locally.
      void syncNow({ silent: true });
    } catch (error) {
      snackbar.show({
        message: error instanceof Error ? error.message : 'Could not save that fill-up',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const odometerError =
    touched && !odometerCheck.valid
      ? odometerCheck.reason === 'decreasing'
        ? 'That is lower than your last reading. Check the number.'
        : odometerCheck.reason === 'implausible_jump'
          ? 'That is a very large jump. Check the number.'
          : 'Enter a valid odometer reading.'
      : undefined;

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
        <Text variant="titleLarge" style={{ flex: 1 }} accessibilityRole="header">
          Log a fill-up
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Odometer"
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
          required
          suffix={distanceUnit}
          leadingIcon="speed"
          error={odometerError}
          supportingText={
            odometerCheck.valid && odometerCheck.warning === 'large_jump'
              ? 'That is a big jump since your last entry — worth double-checking.'
              : undefined
          }
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextField
            label="Volume"
            value={volume}
            onChangeText={(value) => {
              setVolume(value);
              completeAmounts('volume', value);
            }}
            keyboardType="decimal-pad"
            required
            suffix={volumeLabel}
            containerStyle={{ flex: 1 }}
            error={touched && numeric(volume) <= 0 ? 'Required' : undefined}
          />
          <TextField
            label="Price per unit"
            value={unitPrice}
            onChangeText={(value) => {
              setUnitPrice(value);
              completeAmounts('price', value);
            }}
            keyboardType="decimal-pad"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <TextField
          label="Total paid"
          value={total}
          onChangeText={(value) => {
            setTotal(value);
            completeAmounts('total', value);
          }}
          keyboardType="decimal-pad"
          required
          suffix={currency}
          leadingIcon="payments"
          error={touched && numeric(total) <= 0 ? 'Required' : undefined}
        />

        <TextField
          label="Station"
          value={station}
          onChangeText={setStation}
          leadingIcon="local-gas-station"
        />

        <View style={{ gap: 8 }}>
          <Text variant="titleMedium">This fill</Text>
          <ChipGroup>
            <Chip
              label="Full tank"
              variant="filter"
              selected={isFullTank}
              onPress={() => setIsFullTank(true)}
            />
            <Chip
              label="Partial fill"
              variant="filter"
              selected={!isFullTank}
              onPress={() => setIsFullTank(false)}
            />
            <Chip
              label="I missed logging one"
              variant="filter"
              icon="report-problem"
              selected={missedFill}
              onPress={() => setMissedFill((value) => !value)}
            />
          </ChipGroup>
          <Text variant="bodySmall" color="onSurfaceVariant">
            {missedFill
              ? 'This entry will start a fresh measurement instead of producing a misleading figure.'
              : isFullTank
                ? 'Full tanks are what make fuel economy measurable.'
                : 'Partial fills still count toward your spending and roll into the next full tank.'}
          </Text>
        </View>

        {preview ? (
          <Card variant="filled" background={theme.colors.tertiaryContainer}>
            <View style={{ gap: 4 }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                This tank
              </Text>
              <Text variant="numericMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                {format.economy(preview.efficiency)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer }}>
                over {format.distance(preview.distanceKm)} since your last full tank
              </Text>
            </View>
          </Card>
        ) : null}

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Save fill-up"
          size="extraLarge"
          fullWidth
          loading={saving}
          disabled={!canSubmit}
          haptic="success"
          onPress={handleSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
