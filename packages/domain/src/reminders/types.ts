import type { IsoDateTime, Kilometres, UUID } from '../common/types.js';

export type ReminderKind =
  | 'maintenance_due'
  | 'maintenance_overdue'
  | 'document_expiry'
  | 'component_replacement'
  | 'tyre_rotation'
  | 'fuel_anomaly'
  | 'odometer_check_in'
  | 'custom';

export type ReminderSeverity = 'info' | 'warning' | 'critical';

/** A user-authored reminder, independent of any schedule or document. */
export interface CustomReminder {
  readonly id: UUID;
  readonly vehicleId?: UUID;
  readonly title: string;
  readonly body?: string;
  readonly dueAt?: IsoDateTime;
  readonly dueOdometerKm?: Kilometres;
  readonly leadTimeDays?: number;
  readonly repeatEveryDays?: number;
  readonly enabled: boolean;
  readonly completedAt?: IsoDateTime;
}

/**
 * One notification the platform layer should schedule.
 *
 * `key` is a stable, content-derived identity: the same underlying situation
 * always produces the same key. That is what lets the scheduler diff a freshly
 * computed plan against what is already registered with the OS and cancel or
 * add only the difference, instead of tearing down and re-registering every
 * notification on every app launch.
 */
export interface PlannedNotification {
  readonly key: string;
  readonly kind: ReminderKind;
  readonly severity: ReminderSeverity;
  readonly vehicleId?: UUID;
  readonly sourceId: UUID;
  readonly fireAt: IsoDateTime;
  readonly title: string;
  readonly body: string;
  /** `carbuddy://` route the notification opens. */
  readonly deepLink: string;
  /** Android notification channel; iOS ignores it. */
  readonly channelId: NotificationChannelId;
}

export type NotificationChannelId = 'maintenance' | 'documents' | 'fuel' | 'general';

export interface NotificationPreferences {
  readonly enabled: boolean;
  /** Per-kind opt-outs. Absent means enabled. */
  readonly mutedKinds?: readonly ReminderKind[];
  /** Local hour (0–23) to deliver day-scheduled reminders. */
  readonly preferredHour: number;
  /** Minutes east of UTC for the user's timezone. */
  readonly utcOffsetMinutes: number;
  /** Do-not-disturb window, local hours. `start` may exceed `end` (overnight). */
  readonly quietHours?: { readonly start: number; readonly end: number };
  /** Hard cap so a neglected garage cannot produce a wall of alerts. */
  readonly maxPerDay: number;
  /** Days before a due date to warn, applied when a source has no own offsets. */
  readonly defaultLeadDays: readonly number[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  preferredHour: 9,
  utcOffsetMinutes: 0,
  quietHours: { start: 22, end: 7 },
  maxPerDay: 3,
  defaultLeadDays: [30, 14, 7, 1],
};

export const CHANNEL_DEFINITIONS: readonly {
  id: NotificationChannelId;
  name: string;
  description: string;
  importance: 'default' | 'high';
}[] = [
  {
    id: 'maintenance',
    name: 'Service reminders',
    description: 'Upcoming and overdue maintenance for your vehicles.',
    importance: 'high',
  },
  {
    id: 'documents',
    name: 'Document expiry',
    description: 'Registration, insurance, licence and inspection deadlines.',
    importance: 'high',
  },
  {
    id: 'fuel',
    name: 'Fuel insights',
    description: 'Unusual changes in fuel economy and fuel logging nudges.',
    importance: 'default',
  },
  {
    id: 'general',
    name: 'General',
    description: 'Your own reminders and everything else.',
    importance: 'default',
  },
];
