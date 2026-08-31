import * as SQLite from 'expo-sqlite';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './schema';

const DATABASE_NAME = 'carbuddy.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Open the local database, running any pending migrations.
 *
 * The promise is cached rather than the database handle, so concurrent callers
 * during startup all await the *same* migration run. Without that, two screens
 * mounting simultaneously can both start migrating and race on `PRAGMA
 * user_version`.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate().catch((error) => {
      // Let the next caller retry rather than caching a rejected promise.
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // WAL keeps reads from blocking on the background sync's writes, which is the
  // difference between a list that scrolls smoothly during a sync and one that
  // hitches. Foreign keys are off by default in SQLite and must be enabled per
  // connection.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= LATEST_SCHEMA_VERSION) return db;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    // Each migration is atomic: a failure halfway through leaves the schema at
    // the previous version rather than in an undefined half-migrated state.
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        // PRAGMAs are not permitted inside a transaction on some builds.
        if (statement.trim().toUpperCase().startsWith('PRAGMA')) continue;
        await db.execAsync(statement);
      }
    });
    await db.execAsync(`PRAGMA user_version = ${migration.version};`);
  }

  return db;
}

/** Close and forget the handle. Used on sign-out, before wiping the file. */
export async function closeDatabase(): Promise<void> {
  if (!databasePromise) return;
  const db = await databasePromise;
  await db.closeAsync();
  databasePromise = null;
}

/**
 * Delete every local record on sign-out.
 *
 * Deletes rather than drops so the schema survives and the next user does not
 * pay for a migration run. Order matters only because foreign keys are on; the
 * children go first.
 */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  const tables = [
    'sync_queue',
    'sync_conflicts',
    'scheduled_notifications',
    'attachments',
    'odometer_readings',
    'reminders',
    'expenses',
    'documents',
    'vehicle_components',
    'maintenance_schedules',
    'maintenance_records',
    'fuel_records',
    'vehicles',
    'user_preferences',
    'users',
    'sync_state',
  ];

  await db.withTransactionAsync(async () => {
    for (const table of tables) {
      await db.runAsync(`DELETE FROM ${table};`);
    }
  });
}

/** Read a value from the key/value `sync_state` table. */
export async function getSyncState(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?;',
    [key],
  );
  return row?.value ?? null;
}

export async function setSyncState(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    [key, value, new Date().toISOString()],
  );
}
