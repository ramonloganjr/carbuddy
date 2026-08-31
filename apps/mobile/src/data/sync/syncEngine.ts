import {
  coalesceMutations,
  dueMutations,
  mergeRecords,
  nextRetryDelayMs,
  summariseQueue,
  type MutationResult,
  type QueuedMutation,
  type SyncEntity,
  type SyncStatus,
  type SyncableRecord,
} from '@carbuddy/domain';
import { getDatabase, getSyncState, setSyncState } from '../db/database';
import { ALL_REPOSITORIES, generateId } from '../repositories';
import { getDeviceId } from '../../lib/device';
import type { ApiClient } from '../../lib/api/client';

const CURSOR_KEY = 'sync.cursor';
const LAST_SYNC_KEY = 'sync.lastSyncedAt';

interface QueueRow {
  id: string;
  entity: string;
  entity_id: string;
  operation: string;
  payload_json: string;
  base_version: number;
  created_at: string;
  attempts: number;
  status: string;
  last_error: string | null;
  next_attempt_at: string | null;
  device_id: string;
}

function toMutation(row: QueueRow): QueuedMutation {
  return {
    id: row.id,
    entity: row.entity as SyncEntity,
    entityId: row.entity_id,
    operation: row.operation as QueuedMutation['operation'],
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    baseVersion: row.base_version,
    createdAt: row.created_at,
    attempts: row.attempts,
    status: row.status as QueuedMutation['status'],
    ...(row.last_error ? { lastError: row.last_error } : {}),
    ...(row.next_attempt_at ? { nextAttemptAt: row.next_attempt_at } : {}),
    deviceId: row.device_id,
  };
}

const repositoryFor = (entity: SyncEntity) =>
  ALL_REPOSITORIES.find((repo) => repo.entity === entity) ?? null;

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  status: SyncStatus;
}

/**
 * Bidirectional sync.
 *
 * Push before pull, deliberately. Pulling first would overwrite local rows the
 * user has just edited, and the merge would then be reconciling the server's
 * copy against *itself* rather than against the user's work. Sending local
 * changes first means the server has seen them before it tells us what it
 * thinks the truth is.
 *
 * Every stage is resumable: a failure mid-way leaves the queue intact and the
 * cursor unmoved, so the next attempt picks up exactly where this one stopped.
 */
export class SyncEngine {
  private running = false;

  constructor(private readonly api: ApiClient) {}

  async sync(options: { online: boolean }): Promise<SyncResult> {
    if (!options.online) {
      return { pushed: 0, pulled: 0, conflicts: 0, status: await this.status(false, false) };
    }
    if (this.running) {
      return { pushed: 0, pulled: 0, conflicts: 0, status: await this.status(true, true) };
    }

    this.running = true;
    try {
      const pushed = await this.push();
      const { pulled, conflicts } = await this.pull();
      await setSyncState(LAST_SYNC_KEY, new Date().toISOString());
      return { pushed, pulled, conflicts, status: await this.status(true, false) };
    } finally {
      this.running = false;
    }
  }

  /** Send queued local changes. */
  private async push(): Promise<number> {
    const db = await getDatabase();
    const now = new Date();

    const rows = await db.getAllAsync<QueueRow>(
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC;`,
    );

    // Collapse redundant edits before hitting the network: four offline edits
    // to one record become one request rather than four chances to conflict.
    const coalesced = coalesceMutations(rows.map(toMutation));
    const due = dueMutations(coalesced, now);
    if (due.length === 0) return 0;

    // Mark in-flight so a second sync triggered by a reconnect cannot send the
    // same mutations twice.
    await db.withTransactionAsync(async () => {
      for (const mutation of due) {
        await db.runAsync(`UPDATE sync_queue SET status = 'in_flight' WHERE id = ?;`, [
          mutation.id,
        ]);
      }
    });

    let applied = 0;
    try {
      const deviceId = await getDeviceId();
      const results = await this.api.pushMutations({ deviceId, mutations: due });
      for (const result of results) {
        applied += (await this.applyMutationResult(result)) ? 1 : 0;
      }
    } catch (error) {
      // Network failure: return everything to the queue with backoff so the
      // work is not lost and the server is not hammered on reconnect.
      const message = error instanceof Error ? error.message : 'Sync failed';
      await db.withTransactionAsync(async () => {
        for (const mutation of due) {
          const attempts = mutation.attempts + 1;
          const retryAt = new Date(now.getTime() + nextRetryDelayMs(attempts)).toISOString();
          await db.runAsync(
            `UPDATE sync_queue SET status = 'failed', attempts = ?, last_error = ?, next_attempt_at = ?
               WHERE id = ?;`,
            [attempts, message, retryAt, mutation.id],
          );
        }
      });
      throw error;
    }

    return applied;
  }

  private async applyMutationResult(result: MutationResult): Promise<boolean> {
    const db = await getDatabase();

    switch (result.status) {
      case 'applied':
      case 'duplicate': {
        // `duplicate` means the server already had this mutation — a retry
        // after a response was lost. Treated as success, which is what makes
        // the whole push idempotent.
        const row = await db.getFirstAsync<QueueRow>('SELECT * FROM sync_queue WHERE id = ?;', [
          result.mutationId,
        ]);
        if (row) {
          const repo = repositoryFor(row.entity as SyncEntity);
          await repo?.markClean(row.entity_id, result.record.version);
        }
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [result.mutationId]);
        return true;
      }

      case 'conflict': {
        await this.recordConflict(result);
        return false;
      }

      case 'rejected': {
        // A rejection is permanent (validation, permission). Retrying would
        // fail identically forever, so it is surfaced rather than looped.
        await db.runAsync(
          `UPDATE sync_queue SET status = 'failed', last_error = ?, next_attempt_at = NULL WHERE id = ?;`,
          [result.reason, result.mutationId],
        );
        return false;
      }
    }
  }

  /**
   * Attempt an automatic three-way merge; escalate to the user only when both
   * sides genuinely changed the same field.
   */
  private async recordConflict(
    result: Extract<MutationResult, { status: 'conflict' }>,
  ): Promise<void> {
    const db = await getDatabase();
    const queueRow = await db.getFirstAsync<QueueRow>('SELECT * FROM sync_queue WHERE id = ?;', [
      result.mutationId,
    ]);
    if (!queueRow) return;

    const repo = repositoryFor(queueRow.entity as SyncEntity);
    if (!repo) return;

    const localRow = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ${repo.table} WHERE id = ?;`,
      [queueRow.entity_id],
    );
    if (!localRow) return;

    const base = localRow.base_json
      ? (JSON.parse(String(localRow.base_json)) as SyncableRecord)
      : undefined;

    const merged = mergeRecords(localRow as SyncableRecord, result.server, base);

    if (!merged.needsReview) {
      // Clean merge: apply it and re-queue so the server gets the union of both
      // sides rather than either one alone.
      await repo.applyRemote(stripLocalOnly(merged.record));
      await db.runAsync(
        `UPDATE sync_queue SET status = 'pending', base_version = ?, attempts = 0, last_error = NULL, next_attempt_at = NULL
           WHERE id = ?;`,
        [result.server.version, result.mutationId],
      );
      return;
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO sync_conflicts (id, entity, entity_id, local_json, server_json, conflicted_fields, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          generateId(),
          queueRow.entity,
          queueRow.entity_id,
          JSON.stringify(localRow),
          JSON.stringify(result.server),
          JSON.stringify(merged.conflictedFields),
          new Date().toISOString(),
        ],
      );
      await db.runAsync(`UPDATE sync_queue SET status = 'conflicted' WHERE id = ?;`, [
        result.mutationId,
      ]);
    });
  }

  /** Fetch server changes since the last cursor. */
  private async pull(): Promise<{ pulled: number; conflicts: number }> {
    const cursor = await getSyncState(CURSOR_KEY);
    let pulled = 0;
    let hasMore = true;
    let currentCursor = cursor ?? undefined;

    // Paginate until drained. A first sync on a large account can span several
    // pages, and the cursor advances per page so an interruption resumes.
    while (hasMore) {
      const response = await this.api.pullChanges(currentCursor);

      for (const change of response.changes) {
        const repo = repositoryFor(change.entity);
        if (!repo) continue;
        for (const record of change.records) {
          await repo.applyRemote(stripLocalOnly(record));
          pulled += 1;
        }
      }

      currentCursor = response.cursor;
      hasMore = response.hasMore;
      await setSyncState(CURSOR_KEY, response.cursor);
    }

    const db = await getDatabase();
    const conflictRow = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL;',
    );

    return { pulled, conflicts: conflictRow?.n ?? 0 };
  }

  async status(online: boolean, syncing: boolean): Promise<SyncStatus> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<QueueRow>('SELECT * FROM sync_queue;');
    const lastSyncedAt = await getSyncState(LAST_SYNC_KEY);
    const failed = rows.find((r) => r.status === 'failed');

    return summariseQueue({
      queue: rows.map(toMutation),
      online,
      syncing,
      lastSyncedAt,
      lastError: failed?.last_error ?? null,
    });
  }

  /** Apply a user's decision on a conflict the merge could not settle. */
  async resolveConflict(conflictId: string, choice: 'local' | 'server'): Promise<void> {
    const db = await getDatabase();
    const conflict = await db.getFirstAsync<{
      entity: string;
      entity_id: string;
      local_json: string;
      server_json: string;
    }>('SELECT * FROM sync_conflicts WHERE id = ?;', [conflictId]);
    if (!conflict) return;

    const repo = repositoryFor(conflict.entity as SyncEntity);
    if (!repo) return;

    const chosen = JSON.parse(
      choice === 'local' ? conflict.local_json : conflict.server_json,
    ) as SyncableRecord;

    await db.withTransactionAsync(async () => {
      await repo.applyRemote(stripLocalOnly(chosen));
      await db.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?;', [
        new Date().toISOString(),
        conflictId,
      ]);
      await db.runAsync(
        `UPDATE sync_queue SET status = ? WHERE entity = ? AND entity_id = ? AND status = 'conflicted';`,
        [choice === 'local' ? 'pending' : 'done', conflict.entity, conflict.entity_id],
      );
      if (choice === 'server') {
        await db.runAsync(
          `DELETE FROM sync_queue WHERE entity = ? AND entity_id = ? AND status = 'done';`,
          [conflict.entity, conflict.entity_id],
        );
      }
    });
  }
}

/**
 * Strip columns that exist only on the device.
 *
 * `dirty` and `base_json` are local bookkeeping; writing a server payload that
 * happened to carry them would corrupt the sync state.
 */
function stripLocalOnly(record: Record<string, unknown>): Record<string, unknown> {
  const { dirty: _dirty, base_json: _base, ...rest } = record;
  return rest;
}
