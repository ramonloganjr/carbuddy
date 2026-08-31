import { useCallback, useEffect, useState } from 'react';
import type { DashboardViewModel } from '@carbuddy/domain';
import { loadDashboard } from '../../data/queries';
import { usePreferences } from '../settings/preferencesStore';
import { useSession } from '../auth/sessionStore';
import { useVehicles } from '../vehicles/vehicleStore';

export interface DashboardResult {
  data: DashboardViewModel | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Load the dashboard for the currently selected vehicle.
 *
 * Reads straight from SQLite and computes in-process, so there is no network in
 * this path at all — the screen renders the same offline as online. `loading`
 * is only true on the very first load for a vehicle; switching vehicles keeps
 * the previous view on screen until the new one is ready, which avoids a
 * skeleton flash on what is usually a sub-frame operation.
 */
export function useDashboard(): DashboardResult {
  const userId = useSession((state) => state.userId);
  const vehicleId = useVehicles((state) => state.selectedVehicleId);
  const economyStandard = usePreferences((state) => state.preferences?.economyStandard ?? 'km_l');

  const [data, setData] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId || !vehicleId) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const result = await loadDashboard({ userId, vehicleId, economyStandard });
      setData(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, [economyStandard, userId, vehicleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
