import {
  addDays,
  addMonths,
  clamp,
  daysBetween,
  round,
  type IsoDateTime,
  type Kilometres,
} from '../common/types.js';
import type {
  DueDriver,
  DueStatus,
  MaintenanceRecord,
  MaintenanceSchedule,
  ScheduleContext,
  ScheduleEvaluation,
} from './types.js';

export const DEFAULT_LEAD_TIME_DAYS = 14;
export const DEFAULT_LEAD_TIME_KM = 500;

/**
 * Evaluate one recurring service rule against the vehicle's current state.
 *
 * The core rule is "whichever comes first": a schedule with both a time and a
 * distance bound is due as soon as *either* is reached. Both bounds are
 * evaluated independently and the more urgent one wins, with `driver`
 * reporting which — so the UI can say "due by mileage" rather than leaving the
 * user to guess why their 3-month-old oil change is flagged.
 *
 * Pure: the current time arrives through `context`, never from `Date.now()`,
 * which is what makes due-date behaviour testable at arbitrary points in time.
 */
export function evaluateSchedule(
  schedule: MaintenanceSchedule,
  context: ScheduleContext,
): ScheduleEvaluation {
  const now = context.now instanceof Date ? context.now : new Date(context.now);
  const leadDays = schedule.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const leadKm = schedule.leadTimeKm ?? DEFAULT_LEAD_TIME_KM;

  const base = {
    scheduleId: schedule.id,
    category: schedule.category,
    title: schedule.title,
  };

  const hasTimeRule = typeof schedule.intervalMonths === 'number' && schedule.intervalMonths > 0;
  const hasDistanceRule =
    typeof schedule.intervalDistanceKm === 'number' && schedule.intervalDistanceKm > 0;

  if (!schedule.enabled || (!hasTimeRule && !hasDistanceRule)) {
    return {
      ...base,
      status: 'unknown',
      driver: 'none',
      dueDate: null,
      dueOdometerKm: null,
      daysRemaining: null,
      distanceRemainingKm: null,
      projectedDueDate: null,
      effectiveDueDate: null,
      progress: 0,
      reason: schedule.enabled ? 'No interval configured' : 'Reminder turned off',
    };
  }

  // ---- Time bound -------------------------------------------------------
  let dueDate: Date | null = null;
  let daysRemaining: number | null = null;
  let timeProgress = 0;

  if (hasTimeRule && schedule.lastServicedAt) {
    dueDate = addMonths(schedule.lastServicedAt, schedule.intervalMonths as number);
    daysRemaining = daysBetween(now, dueDate);
    const totalDays = Math.max(1, daysBetween(schedule.lastServicedAt, dueDate));
    timeProgress = daysBetween(schedule.lastServicedAt, now) / totalDays;
  }

  // ---- Distance bound ---------------------------------------------------
  let dueOdometerKm: Kilometres | null = null;
  let distanceRemainingKm: Kilometres | null = null;
  let distanceProgress = 0;

  if (hasDistanceRule && typeof schedule.lastServiceOdometerKm === 'number') {
    dueOdometerKm = schedule.lastServiceOdometerKm + (schedule.intervalDistanceKm as number);
    distanceRemainingKm = dueOdometerKm - context.currentOdometerKm;
    distanceProgress =
      (context.currentOdometerKm - schedule.lastServiceOdometerKm) /
      (schedule.intervalDistanceKm as number);
  }

  // Translate remaining distance into a date using recent driving habits.
  let projectedDueDate: Date | null = null;
  const dailyKm = context.averageDailyDistanceKm ?? null;
  if (distanceRemainingKm !== null && dailyKm !== null && dailyKm > 0) {
    projectedDueDate = addDays(now, distanceRemainingKm / dailyKm);
  }

  // Never anchored, so nothing can be computed yet.
  if (dueDate === null && dueOdometerKm === null) {
    return {
      ...base,
      status: 'unknown',
      driver: 'none',
      dueDate: null,
      dueOdometerKm: null,
      daysRemaining: null,
      distanceRemainingKm: null,
      projectedDueDate: null,
      effectiveDueDate: null,
      progress: 0,
      reason: 'Log this service once to start tracking it',
    };
  }

  // ---- Whichever comes first -------------------------------------------
  const timeStatus = dueDate === null ? null : statusFromDays(daysRemaining as number, leadDays);
  const distanceStatus =
    dueOdometerKm === null ? null : statusFromDistance(distanceRemainingKm as number, leadKm);

  const { status, driver } = mostUrgent(timeStatus, distanceStatus);

  // The date the user should actually act on: the earlier of the calendar
  // bound and the date we expect the mileage bound to be hit.
  const candidateDates = [dueDate, projectedDueDate].filter((d): d is Date => d !== null);
  const effectiveDueDate =
    candidateDates.length > 0
      ? new Date(Math.min(...candidateDates.map((d) => d.getTime())))
      : null;

  return {
    ...base,
    status,
    driver,
    dueDate: dueDate?.toISOString() ?? null,
    dueOdometerKm,
    daysRemaining,
    distanceRemainingKm,
    projectedDueDate: projectedDueDate?.toISOString() ?? null,
    effectiveDueDate: effectiveDueDate?.toISOString() ?? null,
    progress: round(clamp(Math.max(timeProgress, distanceProgress), 0, 2), 3),
    reason: describe(status, driver, daysRemaining, distanceRemainingKm),
  };
}

function statusFromDays(daysRemaining: number, leadDays: number): DueStatus {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return 'due';
  return daysRemaining <= leadDays ? 'due_soon' : 'ok';
}

function statusFromDistance(remainingKm: number, leadKm: number): DueStatus {
  if (remainingKm < 0) return 'overdue';
  if (remainingKm === 0) return 'due';
  return remainingKm <= leadKm ? 'due_soon' : 'ok';
}

const URGENCY: Readonly<Record<DueStatus, number>> = {
  overdue: 4,
  due: 3,
  due_soon: 2,
  ok: 1,
  unknown: 0,
};

function mostUrgent(
  timeStatus: DueStatus | null,
  distanceStatus: DueStatus | null,
): { status: DueStatus; driver: DueDriver } {
  if (timeStatus === null && distanceStatus === null) return { status: 'unknown', driver: 'none' };
  if (timeStatus === null) return { status: distanceStatus as DueStatus, driver: 'distance' };
  if (distanceStatus === null) return { status: timeStatus, driver: 'time' };
  // Ties go to distance: it is the bound drivers under-estimate, and it moves
  // on its own between app opens whereas the calendar bound does not.
  return URGENCY[distanceStatus] >= URGENCY[timeStatus]
    ? { status: distanceStatus, driver: 'distance' }
    : { status: timeStatus, driver: 'time' };
}

function describe(
  status: DueStatus,
  driver: DueDriver,
  daysRemaining: number | null,
  distanceRemainingKm: number | null,
): string {
  if (status === 'unknown') return 'Not enough information yet';

  if (driver === 'distance' && distanceRemainingKm !== null) {
    const km = Math.round(Math.abs(distanceRemainingKm));
    if (status === 'overdue') return `${km} km past due`;
    if (status === 'due') return 'Due now';
    return `${km} km remaining`;
  }

  if (daysRemaining !== null) {
    const days = Math.abs(daysRemaining);
    if (status === 'overdue') return days === 1 ? '1 day overdue' : `${days} days overdue`;
    if (status === 'due') return 'Due today';
    return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
  }

  return 'Scheduled';
}

/** Evaluate a whole schedule set, most urgent first. */
export function evaluateSchedules(
  schedules: readonly MaintenanceSchedule[],
  context: ScheduleContext,
): ScheduleEvaluation[] {
  return schedules
    .map((schedule) => evaluateSchedule(schedule, context))
    .sort((a, b) => {
      const urgency = URGENCY[b.status] - URGENCY[a.status];
      if (urgency !== 0) return urgency;
      // Within a status band, sort by the date the user should act on.
      const aTime = a.effectiveDueDate ? new Date(a.effectiveDueDate).getTime() : Infinity;
      const bTime = b.effectiveDueDate ? new Date(b.effectiveDueDate).getTime() : Infinity;
      return aTime - bTime;
    });
}

/**
 * Re-anchor a schedule from the most recent matching service record.
 *
 * Called after a service is logged so the user never has to update the reminder
 * by hand — logging the work *is* resetting the reminder. An explicit
 * `nextServiceDate` on the record wins over the computed interval, because a
 * garage's own recommendation beats our generic rule.
 */
export function rollForwardSchedule(
  schedule: MaintenanceSchedule,
  records: readonly MaintenanceRecord[],
): MaintenanceSchedule {
  const matching = records
    .filter((r) => r.vehicleId === schedule.vehicleId && r.category === schedule.category)
    .sort((a, b) => new Date(b.servicedAt).getTime() - new Date(a.servicedAt).getTime());

  const latest = matching[0];
  if (!latest) return schedule;

  return {
    ...schedule,
    lastServicedAt: latest.servicedAt,
    lastServiceOdometerKm: latest.odometerKm,
    ...(latest.nextServiceDate && schedule.lastServicedAt
      ? { intervalMonths: monthsBetweenApprox(latest.servicedAt, latest.nextServiceDate) }
      : {}),
  };
}

function monthsBetweenApprox(from: IsoDateTime, to: IsoDateTime): number {
  const days = daysBetween(from, to);
  return Math.max(1, Math.round(days / 30.44));
}
