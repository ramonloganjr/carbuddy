import * as SecureStore from 'expo-secure-store';

/**
 * Authentication token storage.
 *
 * Tokens live in the platform keychain / Android Keystore via `expo-secure-store`
 * and never in AsyncStorage, which is plain unencrypted files readable by
 * anyone with filesystem access to a rooted or jailbroken device. This is a
 * hard rule: an access token grants full API access to someone's vehicle
 * documents.
 *
 * `requireAuthentication` is deliberately not set on the token itself. Gating
 * every silent background refresh behind a biometric prompt would make
 * background sync impossible; the app-lock feature gates the *app*, which is
 * the boundary users actually expect.
 */

const ACCESS_TOKEN_KEY = 'carbuddy.access_token';
const REFRESH_TOKEN_KEY = 'carbuddy.refresh_token';
const EXPIRY_KEY = 'carbuddy.access_token_expiry';
const USER_ID_KEY = 'carbuddy.user_id';

/** Refresh this far before actual expiry, to absorb clock skew and latency. */
const EXPIRY_SKEW_MS = 60_000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  userId: string;
}

export async function saveSession(tokens: SessionTokens): Promise<void> {
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(EXPIRY_KEY, String(expiresAt)),
    SecureStore.setItemAsync(USER_ID_KEY, tokens.userId),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USER_ID_KEY);
  } catch {
    return null;
  }
}

export async function isAccessTokenExpired(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(EXPIRY_KEY);
    if (!raw) return true;
    return Date.now() >= Number(raw) - EXPIRY_SKEW_MS;
  } catch {
    return true;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(EXPIRY_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
  ]).catch(() => undefined);
}

/**
 * Exchange the refresh token for a new access token.
 *
 * Refresh tokens rotate: the server issues a new one on every use and
 * invalidates the old. That limits the damage of a stolen token to a single
 * use, and lets the server detect replay — a second use of a rotated token
 * means the token leaked, and the whole family is revoked.
 */
export async function refreshSession(baseUrl: string): Promise<string | null> {
  let refreshToken: string | null = null;
  try {
    refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${baseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // A rejected refresh token is terminal — the session is over.
      await clearSession();
      return null;
    }

    const tokens = (await response.json()) as SessionTokens;
    await saveSession(tokens);
    return tokens.accessToken;
  } catch {
    // A network failure is not an authentication failure: keep the session so
    // the user is not signed out for going through a tunnel.
    return null;
  }
}
