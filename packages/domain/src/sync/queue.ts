import { clamp, type IsoDateTime } from '../common/types.js';
import type { QueuedMutation, SyncStatus, SyncState } from './types.js';

export interface BackoffOptions {
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly maxAttempts?: number;
  /** Fraction of the delay that is randomised, 0–1. */
  readonly jitterRatio?: number;
}

const BACKOFF_DEFAULTS: Required<BackoffOptions> = {
  baseDelayMs: 2_000,
  maxDelayMs: 5 * 60_000,
  maxAttempts: 8,
  jitterRatio: 0.3,
};

/**
 * Exponential backoff with jitter.
 *
 * The jitter matters more than it looks: when connectivity returns after an
 * outage, every device that queued work retries at once. Without a random
 * spread they arrive in lockstep and hammer the API in synchronised waves.
 *
 * `random` is injected so the schedule is deterministic in tests.
 */
export function nextRetryDelayMs(
  attempt: number,
  options: BackoffOptions = {},
  random: () => number = Math.random,
): number {
  const { baseDelayMs, maxDelayMs, jitterRatio } = { ...BACKOFF_DEFAULTS, ...options };
  const exponential = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  const jitter = exponential * jitterRatio * (random() * 2 - 1);
  return Math.round(clamp(exponential + jitter, 0, maxDelayMs));
}

export function isRetryable(mutation: QueuedMutation, options: BackoffOptions = {}): boolean {
  const { maxAttempts } = { ...BACKOFF_DEFAULTS, ...options };
  if (mutation.status === 'done' || mutation.status === 'conflicted') return false;
  return mutation.attempts < maxAttempts;
}

/** Mutations that are due to be sent right now. */
export function dueMutations(
  queue: readonly QueuedMutation[],
  now: IsoDateTime | Date,
  options: BackoffOptions = {},
): QueuedMutation[] {
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  return queue
    .filter((m) => m.status === 'pending' || m.status === 'failed')
    .filter((m) => isRetryable(m, options))
    .filter((m) => !m.nextAttemptAt || new Date(m.nextAttemptAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Collapse redundant queued work before sending.
 *
 * A user editing a fuel record four times on the train produces four mutations
 * for the same row; sending all four wastes bandwidth and battery and gives the
 * server four chances to conflict. Coalescing folds them into one.
 *
 * The rules preserve intent exactly:
 *   - create then update  -> one create carrying the final values
 *   - update then update  -> one update carrying the merged values
 *   - create then delete  -> nothing at all; the server never heard of the row
 *   - update then delete  -> one delete
 *   - delete then create   -> left alone; that is a genuine re-creation
 *
 * `baseVersion` is taken from the *earliest* mutation, because that is the
 * version the user was actually looking at when they started editing.
 */
export function coalesceMutations(queue: readonly QueuedMutation[]): QueuedMutation[] {
  const ordered = [...queue].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const byEntity = new Map<string, QueuedMutation>();
  const passthrough: QueuedMutation[] = [];

  for (const mutation of ordered) {
    // Anything already in flight or resolved is untouchable.
    if (mutation.status !== 'pending' && mutation.status !== 'failed') {
      passthrough.push(mutation);
      continue;
    }

    const key = `${mutation.entity}:${mutation.entityId}`;
    const existing = byEntity.get(key);

    if (!existing) {
      byEntity.set(key, mutation);
      continue;
    }

    if (mutation.operation === 'delete') {
      if (existing.operation === 'create') {
        byEntity.delete(key); // never existed server-side; drop both
      } else {
        byEntity.set(key, { ...mutation, baseVersion: existing.baseVersion });
      }
      continue;
    }

    if (existing.operation === 'delete') {
      // Re-creation after a delete is a real sequence — do not merge it away.
      passthrough.push(existing);
      byEntity.set(key, mutation);
      continue;
    }

    byEntity.set(key, {
      ...mutation,
      // A create absorbing later updates stays a create.
      operation: existing.operation === 'create' ? 'create' : mutation.operation,
      payload: { ...existing.payload, ...mutation.payload },
      baseVersion: existing.baseVersion,
      createdAt: existing.createdAt,
      attempts: Math.max(existing.attempts, mutation.attempts),
    });
  }

  return [...passthrough, ...byEntity.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export interface QueueSummaryInput {
  readonly queue: readonly QueuedMutation[];
  readonly online: boolean;
  readonly syncing: boolean;
  readonly lastSyncedAt: IsoDateTime | null;
  readonly lastError: string | null;
}

/**
 * The single source of truth for the sync indicator in the app bar.
 *
 * Conflicts outrank errors, and errors outrank being offline: being offline is
 * an expected state the user does not need to act on, while a conflict is
 * waiting on a decision only they can make.
 */
export function summariseQueue(input: QueueSummaryInput): SyncStatus {
  const pendingCount = input.queue.filter(
    (m) => m.status === 'pending' || m.status === 'in_flight',
  ).length;
  const failedCount = input.queue.filter((m) => m.status === 'failed').length;
  const conflictCount = input.queue.filter((m) => m.status === 'conflicted').length;

  let state: SyncState;
  if (conflictCount > 0) state = 'conflicts_pending';
  else if (failedCount > 0 && input.online) state = 'error';
  else if (!input.online) state = 'offline';
  else if (input.syncing) state = 'syncing';
  else state = 'idle';

  return {
    state,
    pendingCount,
    failedCount,
    conflictCount,
    lastSyncedAt: input.lastSyncedAt,
    lastError: input.lastError,
  };
}

/** Short status text for the sync chip. Never colour-only. */
export function describeSyncStatus(status: SyncStatus): string {
  switch (status.state) {
    case 'conflicts_pending':
      return `${status.conflictCount} change${status.conflictCount === 1 ? '' : 's'} need${status.conflictCount === 1 ? 's' : ''} your review`;
    case 'error':
      return 'Some changes could not sync — will retry';
    case 'offline':
      return status.pendingCount > 0
        ? `Offline — ${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} saved on this device`
        : 'Offline — your data is still here';
    case 'syncing':
      return 'Syncing…';
    case 'idle':
      return status.lastSyncedAt ? 'All changes saved' : 'Ready';
  }
}
