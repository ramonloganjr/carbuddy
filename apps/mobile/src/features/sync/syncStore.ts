import { create } from 'zustand';
import * as Network from 'expo-network';
import type { SyncStatus } from '@carbuddy/domain';
import { SyncEngine } from '../../data/sync/syncEngine';
import { apiClient } from '../../lib/api/client';

const engine = new SyncEngine(apiClient);

interface SyncState {
  status: SyncStatus;
  online: boolean;
  syncing: boolean;

  refreshStatus: () => Promise<void>;
  setOnline: (online: boolean) => void;
  syncNow: (options?: { silent?: boolean }) => Promise<void>;
  resolveConflict: (conflictId: string, choice: 'local' | 'server') => Promise<void>;
}

const IDLE_STATUS: SyncStatus = {
  state: 'idle',
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

export const useSync = create<SyncState>((set, get) => ({
  status: IDLE_STATUS,
  online: true,
  syncing: false,

  refreshStatus: async () => {
    const { online, syncing } = get();
    set({ status: await engine.status(online, syncing) });
  },

  setOnline: (online) => {
    const wasOffline = !get().online;
    set({ online });
    // Reconnecting is the moment queued work should go out — but only if we
    // were actually offline, so this does not fire on every status poll.
    if (online && wasOffline) void get().syncNow({ silent: true });
  },

  /**
   * Run a sync.
   *
   * Failures are swallowed on purpose: a sync that cannot reach the server is a
   * normal state for a mobile app, not an error worth interrupting anyone over.
   * The queue keeps the work, the status chip shows the state, and the next
   * attempt happens on its own.
   */
  syncNow: async (options = {}) => {
    if (get().syncing) return;
    set({ syncing: true });
    try {
      const result = await engine.sync({ online: get().online });
      set({ status: result.status });
    } catch {
      set({ status: await engine.status(get().online, false) });
    } finally {
      set({ syncing: false });
    }
    void options;
  },

  resolveConflict: async (conflictId, choice) => {
    await engine.resolveConflict(conflictId, choice);
    await get().refreshStatus();
    await get().syncNow();
  },
}));

/**
 * Poll connectivity.
 *
 * `expo-network` has no change event on every platform, so a light poll is the
 * portable option. Ten seconds is a deliberate compromise: fast enough that
 * queued work goes out shortly after the user regains signal, slow enough that
 * it costs nothing measurable in battery.
 */
export function startNetworkWatcher(): () => void {
  let cancelled = false;

  const check = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      if (cancelled) return;
      useSync.getState().setOnline(Boolean(state.isInternetReachable ?? state.isConnected));
    } catch {
      // Treat an unreadable network state as offline; the queue is safe either way.
    }
  };

  void check();
  // `setInterval` ignores the returned promise, so a rejection inside `check`
  // would become an unhandled rejection. `check` already swallows its own
  // errors; the `void` makes that contract explicit at the call site.
  const interval = setInterval(() => void check(), 10_000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}
