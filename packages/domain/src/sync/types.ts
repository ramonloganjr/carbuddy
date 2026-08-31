import type { IsoDateTime, UUID } from '../common/types.js';

/** Entities that participate in offline sync. */
export type SyncEntity =
  | 'vehicle'
  | 'fuel_record'
  | 'maintenance_record'
  | 'maintenance_schedule'
  | 'vehicle_component'
  | 'document'
  | 'expense'
  | 'reminder'
  | 'odometer_reading'
  | 'user_preferences';

export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Metadata every syncable row carries.
 *
 * `version` is a server-assigned counter, not a timestamp: clock skew between a
 * phone and the server is common enough that timestamps alone cannot decide
 * ordering. The version tells us whether the client's edit was made against the
 * current server state; the timestamp only breaks ties between genuine
 * concurrent edits.
 */
export interface SyncMeta {
  readonly id: UUID;
  readonly version: number;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime | null;
  /** Which device produced the last write — used for deterministic tie-breaks. */
  readonly updatedByDeviceId?: string;
}

export type SyncableRecord = SyncMeta & Record<string, unknown>;

export type QueueStatus = 'pending' | 'in_flight' | 'failed' | 'conflicted' | 'done';

/**
 * One queued offline mutation.
 *
 * `baseVersion` is the version the user was looking at when they made the edit.
 * Sending it lets the server detect that someone else changed the row in the
 * meantime, instead of silently clobbering their work.
 */
export interface QueuedMutation {
  readonly id: UUID;
  readonly entity: SyncEntity;
  readonly entityId: UUID;
  readonly operation: SyncOperation;
  /** Changed fields only, so two offline edits to different fields both survive. */
  readonly payload: Record<string, unknown>;
  readonly baseVersion: number;
  readonly createdAt: IsoDateTime;
  readonly attempts: number;
  readonly status: QueueStatus;
  readonly lastError?: string;
  readonly nextAttemptAt?: IsoDateTime;
  readonly deviceId: string;
}

export interface SyncPushRequest {
  readonly deviceId: string;
  readonly mutations: readonly QueuedMutation[];
  /** Server cursor from the last successful pull. */
  readonly since?: IsoDateTime;
}

export type MutationResult =
  | { readonly mutationId: UUID; readonly status: 'applied'; readonly record: SyncableRecord }
  | {
      readonly mutationId: UUID;
      readonly status: 'conflict';
      readonly server: SyncableRecord;
      readonly conflictedFields: readonly string[];
    }
  | { readonly mutationId: UUID; readonly status: 'rejected'; readonly reason: string }
  | { readonly mutationId: UUID; readonly status: 'duplicate'; readonly record: SyncableRecord };

export interface SyncPullResponse {
  readonly changes: readonly { entity: SyncEntity; records: readonly SyncableRecord[] }[];
  readonly cursor: IsoDateTime;
  readonly hasMore: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'conflicts_pending';

export interface SyncStatus {
  readonly state: SyncState;
  readonly pendingCount: number;
  readonly failedCount: number;
  readonly conflictCount: number;
  readonly lastSyncedAt: IsoDateTime | null;
  readonly lastError: string | null;
}
