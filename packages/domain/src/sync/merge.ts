import type { SyncableRecord } from './types.js';

export type MergeOutcome = 'local' | 'remote' | 'merged' | 'identical';

export interface MergeResult {
  readonly record: SyncableRecord;
  readonly outcome: MergeOutcome;
  /** Fields both sides changed differently; the loser's values are reported. */
  readonly conflictedFields: readonly string[];
  /** True when a human should be asked to confirm the resolution. */
  readonly needsReview: boolean;
}

/** Metadata columns that are never merged as user data. */
const META_FIELDS = new Set(['id', 'version', 'updatedAt', 'deletedAt', 'updatedByDeviceId']);

/**
 * Three-way merge between a local edit, the server's copy, and the common
 * ancestor the local edit was made against.
 *
 * The naive approach — whichever `updatedAt` is later wins the whole row —
 * loses real work: if one device edits the odometer offline while another edits
 * the notes, last-write-wins throws one of them away even though the two edits
 * never touched the same field. Merging per field keeps both.
 *
 * Only genuine same-field collisions are conflicts, and those are resolved
 * deterministically (newer timestamp, then device id as a stable tie-break) and
 * reported so the UI can offer the user the discarded value rather than
 * disappearing it.
 *
 * The `base` is the ancestor the client held. Without it we cannot distinguish
 * "I changed this" from "I never touched this", so the function degrades to a
 * safe last-write-wins and flags the row for review.
 */
export function mergeRecords(
  local: SyncableRecord,
  remote: SyncableRecord,
  base?: SyncableRecord,
): MergeResult {
  // Deletions resolve before field merging: there is no sensible field-level
  // merge between "this row is gone" and "this row changed".
  const deletion = resolveDeletion(local, remote);
  if (deletion) return deletion;

  if (local.version === remote.version && local.updatedAt === remote.updatedAt) {
    return { record: remote, outcome: 'identical', conflictedFields: [], needsReview: false };
  }

  // Fast-forward: nobody else touched the row since the client read it.
  if (base && remote.version === base.version) {
    return {
      record: { ...remote, ...userFields(local) },
      outcome: 'local',
      conflictedFields: [],
      needsReview: false,
    };
  }

  if (!base) {
    const winner = newer(local, remote);
    return {
      record: winner,
      outcome: winner === local ? 'local' : 'remote',
      conflictedFields: [],
      needsReview: true,
    };
  }

  const merged: Record<string, unknown> = { ...remote };
  const conflictedFields: string[] = [];
  const localWinsTie = prefersLocal(local, remote);

  const fields = new Set([
    ...Object.keys(userFields(local)),
    ...Object.keys(userFields(remote)),
    ...Object.keys(userFields(base)),
  ]);

  for (const field of fields) {
    const localValue = local[field];
    const remoteValue = remote[field];
    const baseValue = base[field];

    const localChanged = !deepEqual(localValue, baseValue);
    const remoteChanged = !deepEqual(remoteValue, baseValue);

    if (!localChanged) continue; // remote value already in `merged`
    if (!remoteChanged) {
      merged[field] = localValue; // only this device changed it
      continue;
    }
    if (deepEqual(localValue, remoteValue)) continue; // same edit, both sides

    conflictedFields.push(field);
    if (localWinsTie) merged[field] = localValue;
  }

  return {
    record: {
      ...merged,
      id: remote.id,
      // The server owns the version counter; the client never invents one.
      version: remote.version,
      updatedAt: newer(local, remote).updatedAt,
      updatedByDeviceId: localWinsTie ? local.updatedByDeviceId : remote.updatedByDeviceId,
    } as SyncableRecord,
    outcome: conflictedFields.length > 0 ? 'merged' : 'merged',
    conflictedFields,
    needsReview: conflictedFields.length > 0,
  };
}

/**
 * A delete beats a concurrent edit only if the delete happened later.
 *
 * The reverse — an edit landing after a delete — resurrects the row and is
 * flagged for review, because "I deleted this on my phone and it came back" is
 * alarming enough that the user should be told rather than left to notice.
 */
function resolveDeletion(local: SyncableRecord, remote: SyncableRecord): MergeResult | null {
  const localDeleted = Boolean(local.deletedAt);
  const remoteDeleted = Boolean(remote.deletedAt);
  if (!localDeleted && !remoteDeleted) return null;

  if (localDeleted && remoteDeleted) {
    return {
      record: newer(local, remote),
      outcome: 'remote',
      conflictedFields: [],
      needsReview: false,
    };
  }

  const deleted = localDeleted ? local : remote;
  const edited = localDeleted ? remote : local;
  const deletedAt = new Date(deleted.deletedAt as string).getTime();
  const editedAt = new Date(edited.updatedAt).getTime();

  if (deletedAt >= editedAt) {
    return {
      record: deleted,
      outcome: deleted === local ? 'local' : 'remote',
      conflictedFields: [],
      needsReview: false,
    };
  }

  return {
    record: { ...edited, deletedAt: null },
    outcome: edited === local ? 'local' : 'remote',
    conflictedFields: ['deletedAt'],
    needsReview: true,
  };
}

function userFields(record: SyncableRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!META_FIELDS.has(key)) out[key] = value;
  }
  return out;
}

function newer(a: SyncableRecord, b: SyncableRecord): SyncableRecord {
  return prefersLocal(a, b) ? a : b;
}

/**
 * Deterministic winner between two writes. Timestamp first; when two devices
 * report the same instant, the higher device id wins — arbitrary, but stable,
 * so every client and the server independently reach the same answer.
 */
function prefersLocal(local: SyncableRecord, remote: SyncableRecord): boolean {
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  if (localTime !== remoteTime) return localTime > remoteTime;
  return (local.updatedByDeviceId ?? '') > (remote.updatedByDeviceId ?? '');
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
