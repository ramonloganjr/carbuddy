import * as Crypto from 'expo-crypto';
import type { SyncEntity, SyncOperation } from '@carbuddy/domain';
import { getDatabase } from '../db/database';
import { getDeviceId } from '../../lib/device';

/**
 * Generic offline-first repository.
 *
 * Every write does exactly two things, in one transaction:
 *   1. Updates the local row and marks it `dirty`.
 *   2. Appends a mutation to the sync queue.
 *
 * Doing both atomically is the whole point. If the row were written and the
 * queue entry lost, the change would live on the device forever and silently
 * never reach the server — the worst possible failure for a product whose
 * promise is "your records are safe". A single transaction makes that
 * impossible.
 *
 * The UI never waits on the network: writes return as soon as SQLite commits.
 */

export interface RepositoryConfig<TRow, TDomain> {
  table: string;
  entity: SyncEntity;
  toDomain: (row: TRow) => TDomain;
  /** Domain -> column map. Sync columns are added by the repository. */
  toRow: (domain: TDomain) => Record<string, unknown>;
}

export interface ListOptions {
  where?: string;
  params?: readonly unknown[];
  orderBy?: string;
  limit?: number;
  offset?: number;
  /** Include soft-deleted rows. Off by default. */
  includeDeleted?: boolean;
}

export function generateId(): string {
  return Crypto.randomUUID();
}

export function createRepository<TRow, TDomain extends { id: string }>(
  config: RepositoryConfig<TRow, TDomain>,
) {
  const { table, entity, toDomain, toRow } = config;

  async function list(options: ListOptions = {}): Promise<TDomain[]> {
    const db = await getDatabase();
    const clauses: string[] = [];
    if (!options.includeDeleted) clauses.push('deleted_at IS NULL');
    if (options.where) clauses.push(`(${options.where})`);

    const sql =
      `SELECT * FROM ${table}` +
      (clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '') +
      (options.orderBy ? ` ORDER BY ${options.orderBy}` : '') +
      (options.limit !== undefined ? ` LIMIT ${options.limit}` : '') +
      (options.offset !== undefined ? ` OFFSET ${options.offset}` : '');

    const rows = await db.getAllAsync<TRow>(sql, (options.params ?? []) as never[]);
    return rows.map(toDomain);
  }

  async function get(id: string): Promise<TDomain | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TRow>(
      `SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL;`,
      [id],
    );
    return row ? toDomain(row) : null;
  }

  async function count(where?: string, params: readonly unknown[] = []): Promise<number> {
    const db = await getDatabase();
    const sql =
      `SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL` +
      (where ? ` AND (${where})` : '');
    const row = await db.getFirstAsync<{ n: number }>(sql, params as never[]);
    return row?.n ?? 0;
  }

  async function create(domain: TDomain): Promise<TDomain> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const deviceId = await getDeviceId();
    const columns = { ...toRow(domain), version: 0, created_at: now, updated_at: now, dirty: 1 };

    const keys = Object.keys(columns);
    const placeholders = keys.map(() => '?').join(', ');

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders});`,
        Object.values(columns) as never[],
      );
      await enqueue(db, {
        entity,
        entityId: domain.id,
        operation: 'create',
        payload: toRow(domain),
        baseVersion: 0,
        deviceId,
      });
    });

    return domain;
  }

  /**
   * Patch a row.
   *
   * Only the changed columns are queued, not the whole record. Two devices
   * editing different fields of the same vehicle while offline therefore both
   * keep their edit — sending the full object would make every concurrent edit
   * a conflict, even ones that never overlapped.
   */
  async function update(id: string, patch: Partial<Record<string, unknown>>): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const deviceId = await getDeviceId();

    const existing = await db.getFirstAsync<{ version: number; base_json: string | null }>(
      `SELECT version, base_json FROM ${table} WHERE id = ?;`,
      [id],
    );
    if (!existing) throw new Error(`${entity} ${id} not found`);

    const assignments = Object.keys(patch).map((key) => `${key} = ?`);
    assignments.push('updated_at = ?', 'dirty = 1');

    await db.withTransactionAsync(async () => {
      // Capture the server copy the first time a clean row is edited; that
      // snapshot is the common ancestor the three-way merge needs later.
      if (!existing.base_json) {
        const current = await db.getFirstAsync<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE id = ?;`,
          [id],
        );
        if (current) {
          await db.runAsync(`UPDATE ${table} SET base_json = ? WHERE id = ?;`, [
            JSON.stringify(current),
            id,
          ]);
        }
      }

      await db.runAsync(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?;`, [
        ...Object.values(patch),
        now,
        id,
      ] as never[]);

      await enqueue(db, {
        entity,
        entityId: id,
        operation: 'update',
        payload: patch,
        baseVersion: existing.version,
        deviceId,
      });
    });
  }

  /**
   * Soft-delete.
   *
   * A tombstone rather than a row removal, because a hard delete cannot be
   * synced — the other device would have no way to learn the record ever
   * existed, and would happily push it back.
   */
  async function softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const deviceId = await getDeviceId();

    const existing = await db.getFirstAsync<{ version: number }>(
      `SELECT version FROM ${table} WHERE id = ?;`,
      [id],
    );
    if (!existing) return;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE ${table} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [now, now, id],
      );
      await enqueue(db, {
        entity,
        entityId: id,
        operation: 'delete',
        payload: { deleted_at: now },
        baseVersion: existing.version,
        deviceId,
      });
    });
  }

  /** Undo a soft delete — powers the Undo action on the delete snackbar. */
  async function restore(id: string): Promise<void> {
    await update(id, { deleted_at: null });
  }

  /**
   * Write a record that came from the server. Does not enqueue anything and
   * does not set `dirty`: this is the sync engine applying remote state, not
   * the user making a change.
   */
  async function applyRemote(row: Record<string, unknown>): Promise<void> {
    const db = await getDatabase();
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`);

    await db.runAsync(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}, dirty = 0, base_json = NULL;`,
      Object.values(row) as never[],
    );
  }

  /** Rows with unsent local changes. */
  async function dirtyRows(): Promise<TRow[]> {
    const db = await getDatabase();
    return db.getAllAsync<TRow>(`SELECT * FROM ${table} WHERE dirty = 1;`);
  }

  async function markClean(id: string, version: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE ${table} SET dirty = 0, version = ?, base_json = NULL WHERE id = ?;`,
      [version, id],
    );
  }

  return {
    table,
    entity,
    list,
    get,
    count,
    create,
    update,
    softDelete,
    restore,
    applyRemote,
    dirtyRows,
    markClean,
  };
}

interface EnqueueInput {
  entity: SyncEntity;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseVersion: number;
  deviceId: string;
}

async function enqueue(
  db: Awaited<ReturnType<typeof getDatabase>>,
  input: EnqueueInput,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue
       (id, entity, entity_id, operation, payload_json, base_version, created_at, attempts, status, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?);`,
    [
      generateId(),
      input.entity,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      input.baseVersion,
      new Date().toISOString(),
      input.deviceId,
    ],
  );
}
