import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheet,
  Divider,
  ListItem,
  Pressable,
  StateLayer,
  Text,
  useTheme,
} from '../../design-system';
import { vehicleDisplayName, vehicleSubtitle } from '@carbuddy/domain';
import { useVehicles } from './vehicleStore';
import { useFormatters } from '../settings/useFormatters';

/**
 * Switch vehicles without leaving the screen.
 *
 * Two behaviours, chosen by garage size: with two or three cars, a horizontal
 * chip row shows them all at once and switching is a single tap. Past that the
 * row stops being scannable, so it becomes a button opening a sheet. Anything
 * that costs a household with two cars an extra tap on every launch is worth
 * avoiding.
 */
export function VehicleSwitcher() {
  const theme = useTheme();
  const router = useRouter();
  const format = useFormatters();
  const [sheetOpen, setSheetOpen] = useState(false);

  const vehicles = useVehicles((state) => state.vehicles);
  const selectedId = useVehicles((state) => state.selectedVehicleId);
  const select = useVehicles((state) => state.select);

  if (vehicles.length <= 1) return null;

  const selected = vehicles.find((v) => v.id === selectedId) ?? vehicles[0];

  if (vehicles.length <= 3) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel="Your vehicles"
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {vehicles.map((vehicle) => {
          const isSelected = vehicle.id === selectedId;
          return (
            <Pressable
              key={vehicle.id}
              onPress={() => void select(vehicle.id)}
              haptic="selection"
              shape="full"
              ensureTouchTarget={false}
              accessibilityRole="tab"
              accessibilityLabel={vehicleDisplayName(vehicle)}
              accessibilityState={{ selected: isSelected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 44,
                minHeight: 44,
                paddingHorizontal: 16,
                borderRadius: 22,
                backgroundColor: isSelected
                  ? theme.colors.secondaryContainer
                  : theme.colors.surfaceContainerLow,
                borderWidth: isSelected ? 0 : 1,
                borderColor: theme.colors.outlineVariant,
              }}
            >
              {({ pressed }) => (
                <>
                  <StateLayer
                    color={isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface}
                    pressed={pressed}
                    borderRadius={22}
                  />
                  <MaterialIcons
                    name={isSelected ? 'check' : 'directions-car'}
                    size={18}
                    color={
                      isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant
                    }
                  />
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={{
                      color: isSelected
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.onSurface,
                    }}
                  >
                    {vehicleDisplayName(vehicle)}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        haptic="light"
        shape="full"
        ensureTouchTarget={false}
        accessibilityRole="button"
        accessibilityLabel={`Selected vehicle: ${selected ? vehicleDisplayName(selected) : 'none'}. Change vehicle.`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 44,
          minHeight: 44,
          paddingHorizontal: 16,
          borderRadius: 22,
          alignSelf: 'flex-start',
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        }}
      >
        {({ pressed }) => (
          <>
            <StateLayer color={theme.colors.onSurface} pressed={pressed} borderRadius={22} />
            <MaterialIcons name="directions-car" size={18} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelLarge" numberOfLines={1}>
              {selected ? vehicleDisplayName(selected) : 'Choose a vehicle'}
            </Text>
            <MaterialIcons name="expand-more" size={18} color={theme.colors.onSurfaceVariant} />
          </>
        )}
      </Pressable>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title="Your vehicles"
        heightRatio={0.6}
      >
        <View>
          {vehicles.map((vehicle, index) => (
            <React.Fragment key={vehicle.id}>
              {index > 0 ? <Divider inset /> : null}
              <ListItem
                headline={vehicleDisplayName(vehicle)}
                supportingText={vehicleSubtitle(vehicle)}
                trailingText={format.distance(vehicle.currentOdometerKm)}
                leadingIcon="directions-car"
                selected={vehicle.id === selectedId}
                onPress={() => {
                  void select(vehicle.id);
                  setSheetOpen(false);
                }}
              />
            </React.Fragment>
          ))}

          <Divider />
          <ListItem
            headline="Add a vehicle"
            leadingIcon="add"
            onPress={() => {
              setSheetOpen(false);
              router.push('/vehicle/new');
            }}
          />
        </View>
      </BottomSheet>
    </>
  );
}
