import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatVin,
  maskIdentifier,
  vehicleDisplayName,
  vehicleSubtitle,
  type Vehicle,
} from '@carbuddy/domain';
import {
  Button,
  Card,
  Dialog,
  Divider,
  IconButton,
  ListItem,
  Text,
  useSnackbar,
  useTheme,
} from '../../../design-system';
import { getVehicle } from '../../../data/queries';
import { vehicleRepository } from '../../../data/repositories';
import { useFormatters } from '../../../features/settings/useFormatters';
import { useVehicles } from '../../../features/vehicles/vehicleStore';
import { useSession } from '../../../features/auth/sessionStore';

/**
 * The vehicle profile.
 *
 * Sensitive identifiers render masked and are revealed only on an explicit tap,
 * which is also the moment the reveal is worth an audit entry on the server.
 * Showing a VIN by default would put it on screen every time someone glances at
 * this page in public.
 */
export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const snackbar = useSnackbar();
  const format = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();

  const userId = useSession((state) => state.userId);
  const loadVehicles = useVehicles((state) => state.load);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setVehicle(await getVehicle(id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
        <Text variant="bodyLarge" color="onSurfaceVariant">
          Loading vehicle…
        </Text>
      </View>
    );
  }

  const handleDelete = async () => {
    await vehicleRepository.softDelete(vehicle.id);
    if (userId) await loadVehicles(userId);
    router.back();
    snackbar.show({
      message: `${vehicleDisplayName(vehicle)} removed.`,
      actionLabel: 'Undo',
      onAction: () => {
        void (async () => {
          await vehicleRepository.restore(vehicle.id);
          if (userId) await loadVehicles(userId);
        })();
      },
    });
  };

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
        <View style={{ flex: 1 }} />
        <IconButton
          icon="edit"
          accessibilityLabel="Edit vehicle"
          onPress={() => router.push(`/vehicle/${vehicle.id}/edit`)}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text variant="displaySmall" accessibilityRole="header">
            {vehicleDisplayName(vehicle)}
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            {vehicleSubtitle(vehicle)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card variant="filled" style={{ flex: 1 }}>
            <View style={{ gap: 4 }}>
              <Text variant="labelMedium" color="onSurfaceVariant">
                Odometer
              </Text>
              <Text variant="numericMedium" adjustsFontSizeToFit numberOfLines={1}>
                {format.distance(vehicle.currentOdometerKm)}
              </Text>
            </View>
          </Card>
          <Card variant="filled" style={{ flex: 1 }}>
            <View style={{ gap: 4 }}>
              <Text variant="labelMedium" color="onSurfaceVariant">
                Since purchase
              </Text>
              <Text variant="numericMedium" adjustsFontSizeToFit numberOfLines={1}>
                {vehicle.purchaseOdometerKm !== undefined
                  ? format.distance(vehicle.currentOdometerKm - vehicle.purchaseOdometerKm)
                  : '—'}
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="Analytics"
            variant="tonal"
            icon="insights"
            onPress={() => router.push(`/vehicle/${vehicle.id}/analytics`)}
            style={{ flex: 1 }}
          />
          <Button
            label="Health"
            variant="tonal"
            icon="favorite"
            onPress={() => router.push(`/vehicle/${vehicle.id}/health`)}
            style={{ flex: 1 }}
          />
        </View>

        {/* ---- Specification ---- */}
        <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
          Specification
        </Text>
        <Card variant="filled" padding={4}>
          <Spec label="Make" value={vehicle.make} />
          <Spec label="Model" value={vehicle.model} />
          <Spec label="Variant" value={vehicle.variant} />
          <Spec label="Model year" value={vehicle.modelYear?.toString()} />
          <Spec label="Colour" value={vehicle.colour} />
          <Spec label="Engine" value={vehicle.engineType} />
          <Spec
            label="Displacement"
            value={vehicle.engineDisplacementCc ? `${vehicle.engineDisplacementCc} cc` : undefined}
          />
          <Spec label="Cylinders" value={vehicle.cylinders?.toString()} />
          <Spec label="Transmission" value={vehicle.transmission} />
          <Spec label="Drivetrain" value={vehicle.drivetrain?.toUpperCase()} />
          <Spec
            label="Fuel tank"
            value={vehicle.fuelTankCapacityL ? format.volume(vehicle.fuelTankCapacityL) : undefined}
          />
        </Card>

        {/* ---- Identifiers ---- */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text variant="titleMedium" style={{ flex: 1 }} accessibilityRole="header">
            Identifiers
          </Text>
          <Button
            label={revealed ? 'Hide' : 'Reveal'}
            variant="text"
            size="small"
            icon={revealed ? 'visibility-off' : 'visibility'}
            onPress={() => setRevealed((value) => !value)}
          />
        </View>
        <Card variant="filled" padding={4}>
          <Spec
            label="VIN"
            value={
              vehicle.vin
                ? revealed
                  ? formatVin(vehicle.vin)
                  : maskIdentifier(vehicle.vin, 'vin')
                : undefined
            }
          />
          <Spec
            label="Plate"
            value={
              vehicle.plateNumber
                ? revealed
                  ? vehicle.plateNumber
                  : maskIdentifier(vehicle.plateNumber, 'plate')
                : undefined
            }
          />
          <Spec
            label="Engine number"
            value={
              vehicle.engineNumber
                ? revealed
                  ? vehicle.engineNumber
                  : maskIdentifier(vehicle.engineNumber, 'engineNumber')
                : undefined
            }
          />
          <Spec label="Registration country" value={vehicle.registrationCountry} />
        </Card>

        {/* ---- Ownership ---- */}
        {vehicle.purchasedAt || vehicle.purchasePrice ? (
          <>
            <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
              Ownership
            </Text>
            <Card variant="filled" padding={4}>
              <Spec
                label="Purchased"
                value={vehicle.purchasedAt ? format.date(vehicle.purchasedAt) : undefined}
              />
              <Spec
                label="Purchase price"
                value={vehicle.purchasePrice ? format.money(vehicle.purchasePrice) : undefined}
              />
              <Spec
                label="Purchase odometer"
                value={
                  vehicle.purchaseOdometerKm !== undefined
                    ? format.distance(vehicle.purchaseOdometerKm)
                    : undefined
                }
              />
              <Spec label="Dealer" value={vehicle.dealerName} />
            </Card>
          </>
        ) : null}

        <Card variant="filled" padding={4}>
          <ListItem
            headline="Parts and wear items"
            supportingText="Tyres, battery, brakes and filters"
            leadingIcon="build-circle"
            showChevron
            onPress={() => router.push('/maintenance')}
          />
          <Divider inset />
          <ListItem
            headline="Service schedules"
            supportingText="Intervals and reminders"
            leadingIcon="event-repeat"
            showChevron
            onPress={() => router.push('/maintenance/schedules')}
          />
        </Card>

        <Button
          label="Remove this vehicle"
          variant="text"
          icon="delete-outline"
          fullWidth
          style={{ marginTop: 8 }}
          onPress={() => setConfirmDelete(true)}
        />
      </ScrollView>

      <Dialog
        visible={confirmDelete}
        onDismiss={() => setConfirmDelete(false)}
        title={`Remove ${vehicleDisplayName(vehicle)}?`}
        description="This also removes its fuel log, service history, expenses and documents. You can undo this immediately afterwards."
        icon="delete-outline"
        destructive
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
      />
    </View>
  );
}

/** A label/value row that renders nothing when the value is absent. */
function Spec({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
      }}
    >
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
