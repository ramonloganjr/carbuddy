import { beforeEach, describe, expect, it } from 'vitest';
import { alignToDeliveryWindow, diffPlans, planNotifications } from '../src/reminders/planner.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../src/reminders/types.js';
import { evaluateDocuments } from '../src/documents/expiry.js';
import { evaluateSchedules } from '../src/maintenance/intervals.js';
import { evaluateComponents } from '../src/maintenance/components.js';
import { component, document, resetIds, schedule } from './factories.js';

beforeEach(resetIds);

const NOW = '2025-03-01T12:00:00.000Z';
const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, maxPerDay: 10 };

function vehicleWith(overrides: Record<string, unknown> = {}) {
  return { id: 'vehicle-1', displayName: 'Daily driver', ...overrides };
}

describe('planNotifications', () => {
  it('produces nothing when notifications are switched off', () => {
    const plan = planNotifications({
      now: NOW,
      preferences: { ...prefs, enabled: false },
      vehicles: [vehicleWith()],
    });
    expect(plan).toEqual([]);
  });

  it('schedules a ladder of lead-time warnings before a due date', () => {
    // Due 2025-06-01, i.e. 92 days out — inside the default planning horizon.
    const schedules = evaluateSchedules(
      [
        schedule({
          intervalMonths: 12,
          lastServicedAt: '2024-06-01T00:00:00.000Z',
          intervalDistanceKm: undefined,
        }),
      ],
      { now: NOW, currentOdometerKm: 12_000 },
    );

    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ schedules })],
    });

    expect(plan.length).toBeGreaterThan(1);
    expect(plan.every((n) => n.kind === 'maintenance_due')).toBe(true);
    // Chronological, so the scheduler can register them in order.
    expect([...plan].sort((a, b) => a.fireAt.localeCompare(b.fireAt))).toEqual(plan);
  });

  /**
   * The OS caps how many notifications an app may have pending, so the planner
   * only looks a fixed distance ahead and is re-run on each launch. Server-side
   * push covers a user who does not open the app for months.
   */
  it('does not plan beyond the horizon', () => {
    const schedules = evaluateSchedules(
      [
        schedule({
          intervalMonths: 12,
          lastServicedAt: '2024-09-01T00:00:00.000Z',
          intervalDistanceKm: undefined,
        }),
      ],
      { now: NOW, currentOdometerKm: 12_000 },
    );

    const nearSighted = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ schedules })],
    });
    const farSighted = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ schedules })],
      horizonDays: 365,
    });

    expect(nearSighted).toHaveLength(0);
    expect(farSighted.length).toBeGreaterThan(1);
  });

  it('nudges once about overdue work instead of back-filling missed warnings', () => {
    const schedules = evaluateSchedules(
      [
        schedule({
          intervalMonths: 1,
          lastServicedAt: '2024-01-01T00:00:00.000Z',
          intervalDistanceKm: undefined,
        }),
      ],
      { now: NOW, currentOdometerKm: 12_000 },
    );

    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ schedules })],
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]?.kind).toBe('maintenance_overdue');
    expect(plan[0]?.severity).toBe('critical');
  });

  it('never schedules a notification in the past', () => {
    const docs = [document({ expiresAt: '2020-01-01T00:00:00.000Z' })];
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          documents: docs.map((d) => ({
            document: d,
            evaluation: evaluateDocuments([d], NOW)[0]!,
          })),
        }),
      ],
    });

    expect(
      plan.every((n) => new Date(n.fireAt).getTime() >= new Date(NOW).getTime() - 60_000),
    ).toBe(true);
  });

  it('escalates severity as a document deadline approaches', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z' });
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          documents: [{ document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! }],
        }),
      ],
    });

    const oneDay = plan.find((n) => n.key.endsWith(':1'));
    const sixtyDays = plan.find((n) => n.key.endsWith(':60'));
    expect(oneDay?.severity).toBe('critical');
    expect(sixtyDays?.severity).toBe('info');
  });

  it('respects a per-document reminder opt-out', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z', reminderEnabled: false });
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          documents: [{ document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! }],
        }),
      ],
    });
    expect(plan).toEqual([]);
  });

  it('honours muted kinds', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z' });
    const plan = planNotifications({
      now: NOW,
      preferences: { ...prefs, mutedKinds: ['document_expiry'] },
      vehicles: [
        vehicleWith({
          documents: [{ document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! }],
        }),
      ],
    });
    expect(plan).toEqual([]);
  });

  it('only interrupts about fuel when economy has genuinely worsened', () => {
    const base = {
      severity: 'notable' as const,
      deviationPercent: -20,
      robustScore: -3,
      baseline: { kilometres: 100, litres: 10 },
      recent: { kilometres: 100, litres: 12 },
      baselineSampleSize: 8,
      recentSampleSize: 3,
      factors: [],
    };

    const worse = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ fuelAnomaly: { ...base, direction: 'worse' as const } })],
    });
    const better = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ fuelAnomaly: { ...base, direction: 'better' as const } })],
    });
    const mild = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          fuelAnomaly: { ...base, direction: 'worse' as const, severity: 'info' as const },
        }),
      ],
    });

    expect(worse).toHaveLength(1);
    expect(better).toHaveLength(0);
    expect(mild).toHaveLength(0);
  });

  it('warns when tyres are overdue for rotation', () => {
    const components = evaluateComponents(
      [component({ rotationIntervalKm: 10_000, lastRotatedOdometerKm: 5_000 })],
      { now: NOW, currentOdometerKm: 20_000 },
    );

    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ components })],
    });

    expect(plan.some((n) => n.kind === 'tyre_rotation')).toBe(true);
  });

  it('schedules custom reminders with their lead time', () => {
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [],
      customReminders: [
        {
          id: 'r1',
          title: 'Renew parking permit',
          dueAt: '2025-05-01T00:00:00.000Z',
          leadTimeDays: 7,
          enabled: true,
        },
      ],
    });

    expect(plan).toHaveLength(2); // lead-time warning plus the day itself
    expect(plan.every((n) => n.kind === 'custom')).toBe(true);
  });

  it('skips completed and disabled custom reminders', () => {
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [],
      customReminders: [
        {
          id: 'r1',
          title: 'Done',
          dueAt: '2025-05-01T00:00:00.000Z',
          enabled: true,
          completedAt: NOW,
        },
        { id: 'r2', title: 'Off', dueAt: '2025-05-01T00:00:00.000Z', enabled: false },
      ],
    });
    expect(plan).toEqual([]);
  });

  it('caps notifications per day, keeping the most severe', () => {
    const docs = Array.from({ length: 6 }, (_, i) =>
      document({ id: `doc-${i}`, expiresAt: '2025-06-01T00:00:00.000Z' }),
    );

    const plan = planNotifications({
      now: NOW,
      preferences: { ...prefs, maxPerDay: 2 },
      vehicles: [
        vehicleWith({
          documents: docs.map((d) => ({
            document: d,
            evaluation: evaluateDocuments([d], NOW)[0]!,
          })),
        }),
      ],
    });

    const byDay = new Map<string, number>();
    for (const item of plan) {
      const day = item.fireAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    expect([...byDay.values()].every((count) => count <= 2)).toBe(true);
  });

  it('deduplicates identical situations', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z' });
    const entry = { document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! };
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [vehicleWith({ documents: [entry, entry] })],
    });

    expect(new Set(plan.map((n) => n.key)).size).toBe(plan.length);
  });

  it('routes each kind to the right Android channel', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z' });
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          documents: [{ document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! }],
        }),
      ],
    });
    expect(plan.every((n) => n.channelId === 'documents')).toBe(true);
  });

  it('gives every notification a deep link', () => {
    const doc = document({ expiresAt: '2025-06-01T00:00:00.000Z' });
    const plan = planNotifications({
      now: NOW,
      preferences: prefs,
      vehicles: [
        vehicleWith({
          documents: [{ document: doc, evaluation: evaluateDocuments([doc], NOW)[0]! }],
        }),
      ],
    });
    expect(plan.every((n) => n.deepLink.startsWith('carbuddy://'))).toBe(true);
  });
});

describe('alignToDeliveryWindow', () => {
  it('moves a reminder to the preferred local hour', () => {
    const result = alignToDeliveryWindow('2025-06-01T23:30:00.000Z', {
      ...prefs,
      preferredHour: 9,
      utcOffsetMinutes: 0,
      quietHours: undefined,
    });
    expect(result.toISOString()).toBe('2025-06-01T09:00:00.000Z');
  });

  it('accounts for the user timezone rather than the host clock', () => {
    // 09:00 local at UTC+8 is 01:00 UTC.
    const result = alignToDeliveryWindow('2025-06-01T12:00:00.000Z', {
      ...prefs,
      preferredHour: 9,
      utcOffsetMinutes: 480,
      quietHours: undefined,
    });
    expect(result.toISOString()).toBe('2025-06-01T01:00:00.000Z');
  });

  it('pushes a reminder out of quiet hours', () => {
    const result = alignToDeliveryWindow('2025-06-01T12:00:00.000Z', {
      ...prefs,
      preferredHour: 23,
      utcOffsetMinutes: 0,
      quietHours: { start: 22, end: 7 },
    });
    // 23:00 is inside the overnight window, so it lands at 07:00 the next day.
    expect(result.toISOString()).toBe('2025-06-02T07:00:00.000Z');
  });

  it('leaves a reminder already outside quiet hours alone', () => {
    const result = alignToDeliveryWindow('2025-06-01T12:00:00.000Z', {
      ...prefs,
      preferredHour: 9,
      utcOffsetMinutes: 0,
      quietHours: { start: 22, end: 7 },
    });
    expect(result.toISOString()).toBe('2025-06-01T09:00:00.000Z');
  });
});

describe('diffPlans', () => {
  const notification = (key: string, fireAt: string) => ({
    key,
    kind: 'custom' as const,
    severity: 'info' as const,
    sourceId: 'x',
    fireAt,
    title: 't',
    body: 'b',
    deepLink: 'carbuddy://x',
    channelId: 'general' as const,
  });

  it('schedules only what changed', () => {
    const next = [
      notification('a', '2025-06-01T09:00:00.000Z'),
      notification('b', '2025-06-02T09:00:00.000Z'),
    ];
    const existing = [
      { key: 'a', fireAt: '2025-06-01T09:00:00.000Z' },
      { key: 'c', fireAt: '2025-05-01T09:00:00.000Z' },
    ];

    const diff = diffPlans(next, existing);

    expect(diff.unchanged).toEqual(['a']);
    expect(diff.toSchedule.map((n) => n.key)).toEqual(['b']);
    expect(diff.toCancel).toEqual(['c']);
  });

  it('reschedules a notification whose time moved', () => {
    const diff = diffPlans(
      [notification('a', '2025-06-05T09:00:00.000Z')],
      [{ key: 'a', fireAt: '2025-06-01T09:00:00.000Z' }],
    );
    expect(diff.toSchedule.map((n) => n.key)).toEqual(['a']);
    expect(diff.unchanged).toEqual([]);
  });
});
