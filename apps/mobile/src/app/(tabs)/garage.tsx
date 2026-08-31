import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  maskedIdentifiers,
  vehicleDisplayName,
  vehicleSubtitle,
  type Vehicle,
} from '@carbuddy/domain';
import { Button, Card, Divider, EmptyState, ListItem, Text, useTheme } from '../../design-system';
import { listVehicles } from '../../data/queries';
import { useSession } from '../../features/auth/sessionStore';
import { useVehicles } from '../../features/vehicles/vehicleStore';
import { useSync } from '../../features/sync/syncStore';
import { useFormatters } from '../../features/settings/useFormatters';
import { describeSyncStatus } from '@carbuddy/domain';

/**
 * The garage: every vehicle, plus the app-level settings that do not belong to
 * any one of them.
 */
export default function GarageScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const format = useFormatters();

  const userId = useSession((state) => state.userId);
  const selectedId = useVehicles((state) => state.selectedVehicleId);
  const select = useVehicles((state) => state.select);
  const syncStatus = useSync((state) => state.status);
  const syncNow = useSync((state) => state.syncNow);

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setVehicles([]);
      return;
    }
    setVehicles(await listVehicles(userId));
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        Garage
      </Text>

      {vehicles && vehicles.length === 0 ? (
        <EmptyState
          icon="directions-car"
          title="No vehicles yet"
          description="Add your car, motorbike or van to start tracking its fuel, servicing and running costs."
          actionLabel="Add a vehicle"
          onAction={() => router.push('/vehicle/new')}
          compact
        />
      ) : null}

      {vehicles?.map((vehicle) => {
        const masked = maskedIdentifiers(vehicle);
        const isSelected = vehicle.id === selectedId;

        return (
          <Card
            key={vehicle.id}
            variant={isSelected ? 'filled' : 'outlined'}
            background={isSelected ? theme.colors.secondaryContainer : undefined}
            onPress={() => router.push(`/vehicle/${vehicle.id}`)}
            accessibilityLabel={`${vehicleDisplayName(vehicle)}. ${vehicleSubtitle(vehicle)}. ${format.distance(vehicle.currentOdometerKm)}.`}
          >
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="titleLargeEmphasized" numberOfLines={1}>
                    {vehicleDisplayName(vehicle)}
                  </Text>
                  <Text variant="bodyMedium" color="onSurfaceVariant" numberOfLines={1}>
                    {vehicleSubtitle(vehicle)}
                  </Text>
                </View>
                {isSelected ? (
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={theme.colors.onSecondaryContainer}
                  />
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                <Detail label="Odometer" value={format.distance(vehicle.currentOdometerKm)} />
                {masked.plate ? <Detail label="Plate" value={masked.plate} /> : null}
                {vehicle.fuelTankCapacityL ? (
                  <Detail label="Tank" value={format.volume(vehicle.fuelTankCapacityL)} />
                ) : null}
              </View>

              {!isSelected ? (
                <Button
                  label="Switch to this vehicle"
                  variant="tonal"
                  size="small"
                  onPress={() => void select(vehicle.id)}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      <Button
        label="Add a vehicle"
        icon="add"
        variant="tonal"
        fullWidth
        onPress={() => router.push('/vehicle/new')}
      />

      {/* ---- App settings ---- */}
      <Text variant="titleMedium" style={{ paddingHorizontal: 4 }} accessibilityRole="header">
        Settings
      </Text>
      <Card variant="filled" padding={4}>
        <ListItem
          headline="Units and currency"
          supportingText={`${format.distanceUnit} · ${format.volumeUnit} · ${format.economyUnit}`}
          leadingIcon="straighten"
          showChevron
          onPress={() => router.push('/settings/units')}
        />
        <Divider inset />
        <ListItem
          headline="Notifications"
          supportingText="Reminders for services, documents and fuel"
          leadingIcon="notifications"
          showChevron
          onPress={() => router.push('/settings/notifications')}
        />
        <Divider inset />
        <ListItem
          headline="Appearance"
          supportingText="Theme and dynamic colour"
          leadingIcon="palette"
          showChevron
          onPress={() => router.push('/settings/appearance')}
        />
        <Divider inset />
        <ListItem
          headline="Privacy and security"
          supportingText="App lock and data"
          leadingIcon="lock"
          showChevron
          onPress={() => router.push('/settings/security')}
        />
        <Divider inset />
        <ListItem
          headline="Sync"
          supportingText={describeSyncStatus(syncStatus)}
          leadingIcon={syncStatus.state === 'offline' ? 'cloud-off' : 'cloud-done'}
          onPress={() => void syncNow()}
        />
      </Card>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="labelSmall" color="onSurfaceVariant">
        {label}
      </Text>
      <Text variant="numericSmall">{value}</Text>
    </View>
  );
}
