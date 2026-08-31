import { addDays, MS_PER_DAY, type IsoDateTime } from '../common/types.js';
import type { DocumentEvaluation, VehicleDocument } from '../documents/types.js';
import { reminderOffsetsFor } from '../documents/expiry.js';
import type { ComponentEvaluation } from '../maintenance/components.js';
import type { ScheduleEvaluation } from '../maintenance/types.js';
import type { EfficiencyAnomaly } from '../fuel/anomaly.js';
import type {
  CustomReminder,
  NotificationPreferences,
  PlannedNotification,
  ReminderKind,
  ReminderSeverity,
} from './types.js';

export interface PlannerInput {
  readonly now: IsoDateTime | Date;
  readonly preferences: NotificationPreferences;
  readonly vehicles: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly schedules?: readonly ScheduleEvaluation[];
    readonly components?: readonly ComponentEvaluation[];
    readonly documents?: readonly { document: VehicleDocument; evaluation: DocumentEvaluation }[];
    readonly fuelAnomaly?: EfficiencyAnomaly | null;
  }[];
  readonly customReminders?: readonly CustomReminder[];
  /** How far ahead to plan. The OS caps pending notifications, so we do too. */
  readonly horizonDays?: number;
}

const DEFAULT_HORIZON_DAYS = 120;

/**
 * Turn everything the app knows into a concrete, ordered notification schedule.
 *
 * This is the single place notification timing is decided. Keeping it pure —
 * no OS calls, no clock reads — means the whole policy (lead times, quiet
 * hours, daily caps, overdue nudges) is unit-testable at any simulated date,
 * and the identical plan can be produced on the device for local notifications
 * and on the server for push, so the two never disagree.
 *
 * Order of operations matters and is deliberate:
 *   1. Generate candidates from every source.
 *   2. Drop anything muted, already past, or beyond the horizon.
 *   3. Move each candidate to the user's preferred hour, out of quiet hours.
 *   4. Deduplicate by key.
 *   5. Enforce the per-day cap, keeping the most severe.
 */
export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const { preferences } = input;
  if (!preferences.enabled) return [];

  const now = input.now instanceof Date ? input.now : new Date(input.now);
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const horizon = addDays(now, horizonDays).getTime();
  const muted = new Set<ReminderKind>(preferences.mutedKinds ?? []);

  const candidates: PlannedNotification[] = [];

  for (const vehicle of input.vehicles) {
    candidates.push(...maintenanceCandidates(vehicle, preferences, now));
    candidates.push(...componentCandidates(vehicle, now));
    candidates.push(...documentCandidates(vehicle, now));
    const anomaly = fuelAnomalyCandidate(vehicle, now);
    if (anomaly) candidates.push(anomaly);
  }

  candidates.push(...customCandidates(input.customReminders ?? [], preferences, now));

  const scheduled = candidates
    .filter((c) => !muted.has(c.kind))
    .map((c) => ({ ...c, fireAt: alignToDeliveryWindow(c.fireAt, preferences).toISOString() }))
    .filter((c) => {
      const t = new Date(c.fireAt).getTime();
      // A small grace window keeps a reminder that lands "now" from being
      // dropped by the round-trip through the delivery-window alignment.
      return t >= now.getTime() - 60_000 && t <= horizon;
    });

  const deduped = dedupeByKey(scheduled);
  return enforceDailyCap(deduped, preferences.maxPerDay);
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

function maintenanceCandidates(
  vehicle: PlannerInput['vehicles'][number],
  preferences: NotificationPreferences,
  now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  for (const schedule of vehicle.schedules ?? []) {
    if (schedule.status === 'unknown') continue;

    // Overdue work is nudged once, the next morning, rather than back-filling
    // every lead-time notification that has already sailed past.
    if (schedule.status === 'overdue') {
      out.push({
        key: `maintenance_overdue:${schedule.scheduleId}:${dayStamp(now)}`,
        kind: 'maintenance_overdue',
        severity: 'critical',
        vehicleId: vehicle.id,
        sourceId: schedule.scheduleId,
        fireAt: addDays(now, 1).toISOString(),
        title: `${schedule.title} is overdue`,
        body: `${vehicle.displayName} — ${schedule.reason.toLowerCase()}. Book it in when you can.`,
        deepLink: `carbuddy://vehicle/${vehicle.id}/maintenance/${schedule.scheduleId}`,
        channelId: 'maintenance',
      });
      continue;
    }

    const dueDate = schedule.effectiveDueDate;
    if (!dueDate) continue;

    for (const leadDays of preferences.defaultLeadDays) {
      const fireAt = addDays(dueDate, -leadDays);
      if (fireAt.getTime() < now.getTime()) continue;
      out.push({
        key: `maintenance_due:${schedule.scheduleId}:${leadDays}`,
        kind: 'maintenance_due',
        severity: leadDays <= 7 ? 'warning' : 'info',
        vehicleId: vehicle.id,
        sourceId: schedule.scheduleId,
        fireAt: fireAt.toISOString(),
        title: `${schedule.title} coming up`,
        body:
          schedule.driver === 'distance' && schedule.distanceRemainingKm !== null
            ? `${vehicle.displayName} — about ${Math.round(schedule.distanceRemainingKm)} km to go.`
            : `${vehicle.displayName} — due in ${leadDays} ${leadDays === 1 ? 'day' : 'days'}.`,
        deepLink: `carbuddy://vehicle/${vehicle.id}/maintenance/${schedule.scheduleId}`,
        channelId: 'maintenance',
      });
    }
  }

  return out;
}

function componentCandidates(
  vehicle: PlannerInput['vehicles'][number],
  now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  for (const component of vehicle.components ?? []) {
    if (component.rotationDueInKm !== null && component.rotationDueInKm <= 0) {
      out.push({
        key: `tyre_rotation:${component.componentId}:${dayStamp(now)}`,
        kind: 'tyre_rotation',
        severity: 'info',
        vehicleId: vehicle.id,
        sourceId: component.componentId,
        fireAt: addDays(now, 1).toISOString(),
        title: 'Tyre rotation due',
        body: `${vehicle.displayName} — rotating tyres now helps them wear evenly.`,
        deepLink: `carbuddy://vehicle/${vehicle.id}/components/${component.componentId}`,
        channelId: 'maintenance',
      });
    }

    if (
      component.status !== 'due_soon' &&
      component.status !== 'due' &&
      component.status !== 'overdue'
    ) {
      continue;
    }
    // Estimates are soft by nature, so they get one heads-up rather than the
    // full lead-time ladder that dated deadlines receive.
    if (!component.estimatedReplacementDate) continue;

    const fireAt = addDays(component.estimatedReplacementDate, -14);
    out.push({
      key: `component_replacement:${component.componentId}`,
      kind: 'component_replacement',
      severity: component.status === 'overdue' ? 'warning' : 'info',
      vehicleId: vehicle.id,
      sourceId: component.componentId,
      fireAt: (fireAt.getTime() < now.getTime() ? addDays(now, 1) : fireAt).toISOString(),
      title: `${component.label} may need replacing`,
      body: `${vehicle.displayName} — ${component.reason.toLowerCase()}. This is an estimate, so have it checked.`,
      deepLink: `carbuddy://vehicle/${vehicle.id}/components/${component.componentId}`,
      channelId: 'maintenance',
    });
  }

  return out;
}

function documentCandidates(
  vehicle: PlannerInput['vehicles'][number],
  now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  for (const entry of vehicle.documents ?? []) {
    const { document, evaluation } = entry;
    if (!document.reminderEnabled || !document.expiresAt) continue;

    if (evaluation.status === 'expired') {
      out.push({
        key: `document_expired:${document.id}:${dayStamp(now)}`,
        kind: 'document_expiry',
        severity: 'critical',
        vehicleId: vehicle.id,
        sourceId: document.id,
        fireAt: addDays(now, 1).toISOString(),
        title: `${document.title} has expired`,
        body: `${evaluation.reason}. Driving without it can carry penalties.`,
        deepLink: `carbuddy://documents/${document.id}`,
        channelId: 'documents',
      });
      continue;
    }

    for (const leadDays of reminderOffsetsFor(document)) {
      const fireAt = addDays(document.expiresAt, -leadDays);
      if (fireAt.getTime() < now.getTime()) continue;
      out.push({
        key: `document_expiry:${document.id}:${leadDays}`,
        kind: 'document_expiry',
        severity: leadDays <= 7 ? 'critical' : leadDays <= 30 ? 'warning' : 'info',
        vehicleId: vehicle.id,
        sourceId: document.id,
        fireAt: fireAt.toISOString(),
        title: `${document.title} expires soon`,
        body: `Expires in ${leadDays} ${leadDays === 1 ? 'day' : 'days'}. Renewing early avoids a lapse.`,
        deepLink: `carbuddy://documents/${document.id}`,
        channelId: 'documents',
      });
    }
  }

  return out;
}

function fuelAnomalyCandidate(
  vehicle: PlannerInput['vehicles'][number],
  now: Date,
): PlannedNotification | null {
  const anomaly = vehicle.fuelAnomaly;
  // Only a worsening trend is worth interrupting someone for, and only once it
  // clears the "notable" bar — `info` anomalies live in the app, not the
  // lock screen.
  if (!anomaly || anomaly.direction !== 'worse') return null;
  if (anomaly.severity !== 'notable' && anomaly.severity !== 'significant') return null;

  return {
    key: `fuel_anomaly:${vehicle.id}:${dayStamp(now)}`,
    kind: 'fuel_anomaly',
    severity: 'info',
    vehicleId: vehicle.id,
    sourceId: vehicle.id,
    fireAt: addDays(now, 1).toISOString(),
    title: 'Fuel economy has changed',
    body: `${vehicle.displayName} is using about ${Math.abs(Math.round(anomaly.deviationPercent))}% more fuel than usual. Tap to see what might explain it.`,
    deepLink: `carbuddy://vehicle/${vehicle.id}/fuel/insights`,
    channelId: 'fuel',
  };
}

function customCandidates(
  reminders: readonly CustomReminder[],
  preferences: NotificationPreferences,
  now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  for (const reminder of reminders) {
    if (!reminder.enabled || reminder.completedAt || !reminder.dueAt) continue;

    const leads = reminder.leadTimeDays !== undefined ? [reminder.leadTimeDays, 0] : [0];
    for (const leadDays of leads) {
      const fireAt = addDays(reminder.dueAt, -leadDays);
      if (fireAt.getTime() < now.getTime()) continue;
      out.push({
        key: `custom:${reminder.id}:${leadDays}`,
        kind: 'custom',
        severity: 'info',
        ...(reminder.vehicleId ? { vehicleId: reminder.vehicleId } : {}),
        sourceId: reminder.id,
        fireAt: fireAt.toISOString(),
        title: reminder.title,
        body: reminder.body ?? (leadDays > 0 ? `Due in ${leadDays} days.` : 'Due today.'),
        deepLink: `carbuddy://reminders/${reminder.id}`,
        channelId: 'general',
      });
    }
  }

  // Repeating reminders are expanded by the caller after completion, so the
  // planner stays a pure function of current state.
  void preferences;
  return out;
}

// ---------------------------------------------------------------------------
// Delivery policy
// ---------------------------------------------------------------------------

/**
 * Move a notification to the user's preferred local hour, then out of quiet
 * hours if it lands inside them.
 *
 * Timezone handling is explicit rather than relying on the host's locale: the
 * offset comes from preferences, so the server produces exactly the same
 * instant the device would.
 */
export function alignToDeliveryWindow(
  fireAt: IsoDateTime | Date,
  preferences: NotificationPreferences,
): Date {
  const utc = fireAt instanceof Date ? new Date(fireAt.getTime()) : new Date(fireAt);
  const offsetMs = preferences.utcOffsetMinutes * 60_000;

  // Work in the user's local wall-clock, then convert back.
  const local = new Date(utc.getTime() + offsetMs);
  local.setUTCHours(preferences.preferredHour, 0, 0, 0);

  const quiet = preferences.quietHours;
  if (quiet) {
    let hour = local.getUTCHours();
    const inQuiet =
      quiet.start <= quiet.end
        ? hour >= quiet.start && hour < quiet.end
        : hour >= quiet.start || hour < quiet.end;
    if (inQuiet) {
      // Push to the end of the quiet window; if that wraps past midnight the
      // reminder belongs to the following morning.
      const wrapped = quiet.start > quiet.end && hour >= quiet.start;
      local.setUTCHours(quiet.end, 0, 0, 0);
      if (wrapped) local.setUTCDate(local.getUTCDate() + 1);
      hour = quiet.end;
    }
  }

  return new Date(local.getTime() - offsetMs);
}

function dedupeByKey(items: readonly PlannedNotification[]): PlannedNotification[] {
  const seen = new Map<string, PlannedNotification>();
  for (const item of items) {
    const existing = seen.get(item.key);
    // Same situation reported twice: keep the earlier warning.
    if (!existing || new Date(item.fireAt) < new Date(existing.fireAt)) seen.set(item.key, item);
  }
  return [...seen.values()].sort(
    (a, b) => new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime(),
  );
}

const SEVERITY_RANK: Readonly<Record<ReminderSeverity, number>> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Keep at most `maxPerDay` notifications on any given day, preferring the most
 * severe. Overflow is dropped rather than deferred: a reminder that arrives on
 * the wrong day is worse than one that never arrives, because the user acts on
 * the date in the message.
 */
function enforceDailyCap(
  items: readonly PlannedNotification[],
  maxPerDay: number,
): PlannedNotification[] {
  if (maxPerDay <= 0) return [];

  const byDay = new Map<string, PlannedNotification[]>();
  for (const item of items) {
    const day = item.fireAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(item);
    else byDay.set(day, [item]);
  }

  const kept: PlannedNotification[] = [];
  for (const bucket of byDay.values()) {
    const ranked = [...bucket].sort((a, b) => {
      const severity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (severity !== 0) return severity;
      return new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime();
    });
    kept.push(...ranked.slice(0, maxPerDay));
  }

  return kept.sort((a, b) => new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime());
}

function dayStamp(date: Date): string {
  return new Date(Math.floor(date.getTime() / MS_PER_DAY) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Difference a freshly computed plan against what the OS already has pending,
 * so the scheduler only issues the changes.
 */
export interface PlanDiff {
  readonly toSchedule: readonly PlannedNotification[];
  readonly toCancel: readonly string[];
  readonly unchanged: readonly string[];
}

export function diffPlans(
  next: readonly PlannedNotification[],
  existing: readonly { key: string; fireAt: IsoDateTime }[],
): PlanDiff {
  const existingByKey = new Map(existing.map((e) => [e.key, e]));
  const nextKeys = new Set(next.map((n) => n.key));

  const toSchedule: PlannedNotification[] = [];
  const unchanged: string[] = [];

  for (const item of next) {
    const current = existingByKey.get(item.key);
    if (current && current.fireAt === item.fireAt) unchanged.push(item.key);
    else toSchedule.push(item);
  }

  const toCancel = existing.filter((e) => !nextKeys.has(e.key)).map((e) => e.key);

  return { toSchedule, toCancel, unchanged };
}
