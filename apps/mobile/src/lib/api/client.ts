import Constants from 'expo-constants';
import type { MutationResult, QueuedMutation, SyncPullResponse } from '@carbuddy/domain';
import { getAccessToken, refreshSession, clearSession } from '../auth/session';

/**
 * HTTP client for the CarBuddy API.
 *
 * Two behaviours matter more than anything else here:
 *
 *   1. **Single-flight token refresh.** When a burst of requests all get a 401
 *      at once, only the first refreshes; the rest wait on that same promise.
 *      Without this, a screen firing five requests on resume would issue five
 *      refreshes, and rotating refresh tokens would invalidate each other and
 *      sign the user out.
 *
 *   2. **Timeouts on every request.** A mobile connection can hang open
 *      indefinitely on a captive portal. An `AbortController` turns that into a
 *      normal failure the sync queue can retry, instead of a request that never
 *      settles and a spinner that never stops.
 */

const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Retrying is pointless for 4xx other than 408/429. */
  get isRetryable(): boolean {
    if (this.status === 408 || this.status === 429) return true;
    return this.status >= 500;
  }
}

export class NetworkError extends Error {
  constructor(message = 'No connection') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (sign-in, sign-up, refresh). */
  anonymous?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return configured ?? 'http://localhost:4000';
}

export class ApiClient {
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(private readonly baseUrl: string = resolveBaseUrl()) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.performRequest<T>(path, options, true);
  }

  private async performRequest<T>(
    path: string,
    options: RequestOptions,
    allowRetry: boolean,
  ): Promise<T> {
    const { method = 'GET', body, anonymous = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // Honour an externally supplied signal as well as our own timeout.
    options.signal?.addEventListener('abort', () => controller.abort());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (!anonymous) {
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      // Abort and genuine connectivity failure both surface here; the sync
      // queue treats them identically, as "try again later".
      throw new NetworkError(error instanceof Error ? error.message : 'Request failed');
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && !anonymous && allowRetry) {
      const refreshed = await this.refreshOnce();
      if (refreshed) return this.performRequest<T>(path, options, false);
      await clearSession();
      throw new ApiError('Session expired', 401, 'unauthenticated');
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        code?: string;
        details?: unknown;
      } | null;
      throw new ApiError(
        payload?.message ?? `Request failed (${response.status})`,
        response.status,
        payload?.code,
        payload?.details,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Collapse concurrent refreshes into one in-flight request. */
  private async refreshOnce(): Promise<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = refreshSession(this.baseUrl).finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  async pushMutations(input: {
    deviceId: string;
    mutations: readonly QueuedMutation[];
  }): Promise<MutationResult[]> {
    return this.request<MutationResult[]>('/sync/push', { method: 'POST', body: input });
  }

  async pullChanges(cursor?: string): Promise<SyncPullResponse> {
    const query = cursor ? `?since=${encodeURIComponent(cursor)}` : '';
    return this.request<SyncPullResponse>(`/sync/pull${query}`);
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  /**
   * Ask the server for a short-lived upload URL.
   *
   * The file goes straight from the device to object storage; it never passes
   * through the API. That keeps large receipt photos off the application
   * servers and means the URL, not a long-lived credential, is what grants
   * write access — and only for a few minutes.
   */
  async createUploadUrl(input: {
    ownerType: string;
    ownerId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }): Promise<{ attachmentId: string; uploadUrl: string; expiresAt: string }> {
    return this.request('/attachments/upload-url', { method: 'POST', body: input });
  }

  async getDownloadUrl(attachmentId: string): Promise<{ url: string; expiresAt: string }> {
    return this.request(`/attachments/${attachmentId}/download-url`);
  }

  // -------------------------------------------------------------------------
  // Devices & notifications
  // -------------------------------------------------------------------------

  async registerDevice(input: {
    deviceId: string;
    pushToken: string;
    platform: string;
    osVersion: string;
    appVersion: string;
  }): Promise<void> {
    await this.request('/devices', { method: 'POST', body: input });
  }

  async unregisterDevice(deviceId: string): Promise<void> {
    await this.request(`/devices/${deviceId}`, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
