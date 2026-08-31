import { create } from 'zustand';
import type { Vehicle } from '@carbuddy/domain';
import { listVehicles } from '../../data/queries';
import { usePreferences } from '../settings/preferencesStore';

interface VehicleState {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  loading: boolean;

  load: (userId: string) => Promise<void>;
  select: (vehicleId: string) => Promise<void>;
  selected: () => Vehicle | null;
}

/**
 * The garage, plus which vehicle the app is currently showing.
 *
 * The selection is persisted to preferences so the app reopens on the car the
 * user was last looking at. For a two-car household, re-picking the vehicle on
 * every launch would be a constant small annoyance.
 */
export const useVehicles = create<VehicleState>((set, get) => ({
  vehicles: [],
  selectedVehicleId: null,
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    const vehicles = await listVehicles(userId);
    const preferred = usePreferences.getState().preferences?.defaultVehicleId;

    // Fall back through: remembered vehicle -> the one marked primary -> first.
    const selectedVehicleId =
      (preferred && vehicles.some((v) => v.id === preferred) ? preferred : null) ??
      vehicles.find((v) => v.isPrimary)?.id ??
      vehicles[0]?.id ??
      null;

    set({ vehicles, selectedVehicleId, loading: false });
  },

  select: async (vehicleId) => {
    set({ selectedVehicleId: vehicleId });
    await usePreferences.getState().update({ defaultVehicleId: vehicleId });
  },

  selected: () => {
    const { vehicles, selectedVehicleId } = get();
    return vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  },
}));
