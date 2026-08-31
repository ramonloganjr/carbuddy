import { create } from 'zustand';
import { apiClient } from '../../lib/api/client';
import { clearSession, getUserId, saveSession, type SessionTokens } from '../../lib/auth/session';
import { clearAllData } from '../../data/db/database';
import { cancelAllNotifications } from '../../lib/notifications';
import { usePreferences } from '../settings/preferencesStore';
import { getDeviceId } from '../../lib/device';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  error: string | null;
  /** True while the biometric app lock is engaged. */
  locked: boolean;

  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setLocked: (locked: boolean) => void;
}

interface AuthResponse extends SessionTokens {
  email: string;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  userId: null,
  email: null,
  error: null,
  locked: false,

  /**
   * Restore a session from the keychain on launch.
   *
   * Deliberately does *not* hit the network. A user opening the app on a plane
   * must reach their data immediately; the stored token is trusted until an
   * actual API call rejects it, at which point the client's refresh flow takes
   * over. Requiring a successful network call to "prove" the session would make
   * an offline-first app unusable offline.
   */
  restore: async () => {
    const userId = await getUserId();
    if (!userId) {
      set({ status: 'unauthenticated', userId: null });
      return;
    }
    await usePreferences.getState().load(userId);
    set({ status: 'authenticated', userId });
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const response = await apiClient.request<AuthResponse>('/auth/sign-in', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password, deviceId: await getDeviceId() },
        anonymous: true,
      });
      await saveSession(response);
      await usePreferences.getState().load(response.userId);
      set({ status: 'authenticated', userId: response.userId, email: response.email });
      return true;
    } catch (error) {
      set({ error: describeAuthError(error) });
      return false;
    }
  },

  signUp: async (email, password, displayName) => {
    set({ error: null });
    try {
      const response = await apiClient.request<AuthResponse>('/auth/sign-up', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          deviceId: await getDeviceId(),
        },
        anonymous: true,
      });
      await saveSession(response);
      await usePreferences.getState().load(response.userId);
      set({ status: 'authenticated', userId: response.userId, email: response.email });
      return true;
    } catch (error) {
      set({ error: describeAuthError(error) });
      return false;
    }
  },

  /**
   * Sign out and leave nothing behind.
   *
   * Local data is wiped, not merely hidden: the next person to sign in on this
   * device must not be able to reach the previous user's documents, and
   * scheduled notifications must stop firing about a car that is no longer
   * theirs.
   */
  signOut: async () => {
    const deviceId = await getDeviceId();
    // Best-effort: never block sign-out on the network.
    await apiClient.unregisterDevice(deviceId).catch(() => undefined);
    await cancelAllNotifications();
    await clearSession();
    await clearAllData();
    usePreferences.getState().reset();
    set({ status: 'unauthenticated', userId: null, email: null, locked: false });
  },

  setLocked: (locked) => set({ locked }),
}));

function describeAuthError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NetworkError') {
      return 'Could not reach CarBuddy. Check your connection and try again.';
    }
    // Deliberately vague on credentials: distinguishing "no such account" from
    // "wrong password" tells an attacker which emails are registered.
    if (error.message.toLowerCase().includes('credential')) {
      return 'That email or password does not match an account.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
