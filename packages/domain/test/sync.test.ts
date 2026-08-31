import { beforeEach, describe, expect, it } from 'vitest';
import { mergeRecords } from '../src/sync/merge.js';
import {
  coalesceMutations,
  describeSyncStatus,
  dueMutations,
  isRetryable,
  nextRetryDelayMs,
  summariseQueue,
} from '../src/sync/queue.js';
import { mutation, resetIds, syncRecord } from './factories.js';

beforeEach(resetIds);

describe('mergeRecords — three-way merge', () => {
  it('fast-forwards when nobody else touched the row', () => {
    const base = syncRecord({ version: 3, notes: 'old', odometerKm: 10_000 });
    const local = syncRecord({
      version: 3,
      notes: 'new',
      odometerKm: 10_000,
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
    const remote = syncRecord({ version: 3, notes: 'old', odometerKm: 10_000 });

    const result = mergeRecords(local, remote, base);

    expect(result.outcome).toBe('local');
    expect(result.record.notes).toBe('new');
    expect(result.needsReview).toBe(false);
  });

  /**
   * The reason field-level merging exists: last-write-wins would throw away one
   * of these two edits even though they never touched the same field.
   */
  it('keeps both edits when two devices changed different fields', () => {
    const base = syncRecord({ version: 3, notes: 'old', odometerKm: 10_000 });
    const local = syncRecord({
      version: 3,
      notes: 'old',
      odometerKm: 12_345,
      updatedAt: '2025-01-02T00:00:00.000Z',
      updatedByDeviceId: 'phone',
    });
    const remote = syncRecord({
      version: 4,
      notes: 'washed it',
      odometerKm: 10_000,
      updatedAt: '2025-01-03T00:00:00.000Z',
      updatedByDeviceId: 'tablet',
    });

    const result = mergeRecords(local, remote, base);

    expect(result.record.odometerKm).toBe(12_345);
    expect(result.record.notes).toBe('washed it');
    expect(result.conflictedFields).toEqual([]);
    expect(result.needsReview).toBe(false);
  });

  it('reports a genuine same-field collision and resolves it by recency', () => {
    const base = syncRecord({ version: 3, odometerKm: 10_000 });
    const local = syncRecord({
      version: 3,
      odometerKm: 11_000,
      updatedAt: '2025-01-05T00:00:00.000Z',
    });
    const remote = syncRecord({
      version: 4,
      odometerKm: 12_000,
      updatedAt: '2025-01-04T00:00:00.000Z',
    });

    const result = mergeRecords(local, remote, base);

    expect(result.conflictedFields).toEqual(['odometerKm']);
    expect(result.record.odometerKm).toBe(11_000); // the later write
    expect(result.needsReview).toBe(true);
  });

  it('breaks a same-instant tie deterministically by device id', () => {
    const base = syncRecord({ version: 3, notes: 'a' });
    const at = '2025-01-05T00:00:00.000Z';
    const local = syncRecord({ version: 3, notes: 'b', updatedAt: at, updatedByDeviceId: 'zzz' });
    const remote = syncRecord({ version: 4, notes: 'c', updatedAt: at, updatedByDeviceId: 'aaa' });

    // Both sides, computing independently, must reach the same answer.
    expect(mergeRecords(local, remote, base).record.notes).toBe('b');
    expect(mergeRecords(local, remote, base).record.notes).toBe('b');
  });

  it('treats identical concurrent edits as agreement, not conflict', () => {
    const base = syncRecord({ version: 3, notes: 'a' });
    const local = syncRecord({ version: 3, notes: 'b', updatedAt: '2025-01-05T00:00:00.000Z' });
    const remote = syncRecord({ version: 4, notes: 'b', updatedAt: '2025-01-04T00:00:00.000Z' });

    expect(mergeRecords(local, remote, base).conflictedFields).toEqual([]);
  });

  it('never lets the client invent a version number', () => {
    const base = syncRecord({ version: 3, notes: 'a' });
    const local = syncRecord({ version: 3, notes: 'b', updatedAt: '2025-01-05T00:00:00.000Z' });
    const remote = syncRecord({ version: 9, notes: 'c', updatedAt: '2025-01-04T00:00:00.000Z' });

    expect(mergeRecords(local, remote, base).record.version).toBe(9);
  });

  it('degrades to last-write-wins and asks for review with no common ancestor', () => {
    const local = syncRecord({ version: 3, notes: 'b', updatedAt: '2025-01-05T00:00:00.000Z' });
    const remote = syncRecord({ version: 4, notes: 'c', updatedAt: '2025-01-04T00:00:00.000Z' });

    const result = mergeRecords(local, remote);

    expect(result.record.notes).toBe('b');
    expect(result.needsReview).toBe(true);
  });

  it('recognises two copies that are already identical', () => {
    const record = syncRecord({ version: 3, notes: 'same' });
    expect(mergeRecords(record, record).outcome).toBe('identical');
  });

  it('lets a later delete win over an earlier edit', () => {
    const local = syncRecord({
      version: 3,
      deletedAt: '2025-01-06T00:00:00.000Z',
      updatedAt: '2025-01-06T00:00:00.000Z',
    });
    const remote = syncRecord({
      version: 4,
      notes: 'edited',
      updatedAt: '2025-01-05T00:00:00.000Z',
    });

    const result = mergeRecords(local, remote);

    expect(result.record.deletedAt).toBe('2025-01-06T00:00:00.000Z');
    expect(result.needsReview).toBe(false);
  });

  /** "I deleted this and it came back" is alarming enough to surface. */
  it('resurrects a row edited after it was deleted, and flags it', () => {
    const local = syncRecord({
      version: 3,
      deletedAt: '2025-01-04T00:00:00.000Z',
      updatedAt: '2025-01-04T00:00:00.000Z',
    });
    const remote = syncRecord({
      version: 4,
      notes: 'edited',
      updatedAt: '2025-01-06T00:00:00.000Z',
    });

    const result = mergeRecords(local, remote);

    expect(result.record.deletedAt).toBeNull();
    expect(result.conflictedFields).toEqual(['deletedAt']);
    expect(result.needsReview).toBe(true);
  });

  it('compares nested values structurally, not by reference', () => {
    const base = syncRecord({ version: 3, tags: ['a', 'b'] });
    const local = syncRecord({
      version: 3,
      tags: ['a', 'b'],
      notes: 'x',
      updatedAt: '2025-01-05T00:00:00.000Z',
    });
    const remote = syncRecord({
      version: 4,
      tags: ['a', 'b'],
      updatedAt: '2025-01-04T00:00:00.000Z',
    });

    expect(mergeRecords(local, remote, base).conflictedFields).toEqual([]);
  });
});

describe('coalesceMutations', () => {
  it('folds repeated edits to one row into a single mutation', () => {
    const result = coalesceMutations([
      mutation({
        id: 'm1',
        payload: { litres: 10 },
        createdAt: '2025-01-01T00:00:00.000Z',
        baseVersion: 2,
      }),
      mutation({
        id: 'm2',
        payload: { litres: 20 },
        createdAt: '2025-01-01T00:01:00.000Z',
        baseVersion: 3,
      }),
      mutation({
        id: 'm3',
        payload: { notes: 'hi' },
        createdAt: '2025-01-01T00:02:00.000Z',
        baseVersion: 4,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.payload).toEqual({ litres: 20, notes: 'hi' });
    // The version the user was actually looking at when they started editing.
    expect(result[0]?.baseVersion).toBe(2);
  });

  it('keeps a create a create when later updates fold into it', () => {
    const result = coalesceMutations([
      mutation({
        id: 'm1',
        operation: 'create',
        payload: { litres: 10 },
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      mutation({
        id: 'm2',
        operation: 'update',
        payload: { litres: 30 },
        createdAt: '2025-01-01T00:01:00.000Z',
      }),
    ]);

    expect(result[0]?.operation).toBe('create');
    expect(result[0]?.payload).toEqual({ litres: 30 });
  });

  it('drops a row created and deleted while offline', () => {
    const result = coalesceMutations([
      mutation({ id: 'm1', operation: 'create', createdAt: '2025-01-01T00:00:00.000Z' }),
      mutation({ id: 'm2', operation: 'delete', createdAt: '2025-01-01T00:01:00.000Z' }),
    ]);
    expect(result).toEqual([]);
  });

  it('collapses update-then-delete into a delete', () => {
    const result = coalesceMutations([
      mutation({ id: 'm1', operation: 'update', createdAt: '2025-01-01T00:00:00.000Z' }),
      mutation({ id: 'm2', operation: 'delete', createdAt: '2025-01-01T00:01:00.000Z' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.operation).toBe('delete');
  });

  it('preserves a genuine delete-then-recreate sequence', () => {
    const result = coalesceMutations([
      mutation({ id: 'm1', operation: 'delete', createdAt: '2025-01-01T00:00:00.000Z' }),
      mutation({ id: 'm2', operation: 'create', createdAt: '2025-01-01T00:01:00.000Z' }),
    ]);

    expect(result.map((m) => m.operation)).toEqual(['delete', 'create']);
  });

  it('never merges across different rows', () => {
    const result = coalesceMutations([
      mutation({ id: 'm1', entityId: 'a' }),
      mutation({ id: 'm2', entityId: 'b' }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('leaves in-flight mutations untouched', () => {
    const result = coalesceMutations([
      mutation({ id: 'm1', status: 'in_flight', createdAt: '2025-01-01T00:00:00.000Z' }),
      mutation({ id: 'm2', status: 'pending', createdAt: '2025-01-01T00:01:00.000Z' }),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('retry policy', () => {
  it('backs off exponentially up to a ceiling', () => {
    const noJitter = () => 0.5; // maps to zero jitter
    expect(nextRetryDelayMs(1, {}, noJitter)).toBe(2_000);
    expect(nextRetryDelayMs(2, {}, noJitter)).toBe(4_000);
    expect(nextRetryDelayMs(3, {}, noJitter)).toBe(8_000);
    expect(nextRetryDelayMs(20, {}, noJitter)).toBe(300_000);
  });

  /** Without jitter, every device that queued work retries in lockstep. */
  it('spreads retries with jitter', () => {
    const low = nextRetryDelayMs(3, {}, () => 0);
    const high = nextRetryDelayMs(3, {}, () => 1);
    expect(low).toBeLessThan(8_000);
    expect(high).toBeGreaterThan(8_000);
  });

  it('never returns a negative delay', () => {
    expect(nextRetryDelayMs(1, { jitterRatio: 2 }, () => 0)).toBeGreaterThanOrEqual(0);
  });

  it('gives up after the attempt limit', () => {
    expect(isRetryable(mutation({ attempts: 3 }))).toBe(true);
    expect(isRetryable(mutation({ attempts: 8 }))).toBe(false);
    expect(isRetryable(mutation({ status: 'conflicted' }))).toBe(false);
  });

  it('holds back mutations that are still in backoff', () => {
    const now = '2025-01-01T00:00:00.000Z';
    const due = dueMutations(
      [
        mutation({ id: 'ready', nextAttemptAt: '2024-12-31T23:00:00.000Z', status: 'failed' }),
        mutation({ id: 'waiting', nextAttemptAt: '2025-01-01T01:00:00.000Z', status: 'failed' }),
      ],
      now,
    );

    expect(due.map((m) => m.id)).toEqual(['ready']);
  });
});

describe('summariseQueue', () => {
  const base = { online: true, syncing: false, lastSyncedAt: null, lastError: null };

  it('puts conflicts above every other state', () => {
    const status = summariseQueue({
      ...base,
      online: false,
      queue: [mutation({ status: 'conflicted' }), mutation({ status: 'failed' })],
    });
    expect(status.state).toBe('conflicts_pending');
  });

  it('reports offline rather than error when there is no connection', () => {
    const status = summariseQueue({
      ...base,
      online: false,
      queue: [mutation({ status: 'failed' })],
    });
    expect(status.state).toBe('offline');
  });

  it('reassures rather than alarms when offline', () => {
    const status = summariseQueue({
      ...base,
      online: false,
      queue: [mutation({ status: 'pending' })],
    });
    expect(describeSyncStatus(status)).toContain('saved on this device');
  });

  it('describes every state in words, never colour alone', () => {
    for (const state of ['idle', 'syncing', 'offline', 'error', 'conflicts_pending'] as const) {
      const text = describeSyncStatus({
        state,
        pendingCount: 1,
        failedCount: 1,
        conflictCount: 1,
        lastSyncedAt: null,
        lastError: null,
      });
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
