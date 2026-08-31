import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  CHANNEL_DEFINITIONS,
  diffPlans,
  planNotifications,
  type PlannedNotification,
  type PlannerInput,
} from '@carbuddy/domain';
import { getDatabase } from '../data/db/database';

/**
 * Local notification scheduling.
 *
 * All of the *policy* — what to notify about, when, how often, how many per day
 * — lives in `@carbuddy/domain`'s planner, which is pure and unit-tested. This
 * module is only the platform adapter: it takes a plan, diffs it against what
 * the OS already holds, and issues the difference.
 *
 * The diff is what keeps this cheap. Re-registering every notification on each
 * launch would churn dozens of OS entries, and on iOS would eventually collide
 * with the 64-pending-notification limit.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/**
 * Create the Android notification channels.
 *
 * Channels must exist before the first notification is posted, and they are
 * immutable afterwards — importance can only be changed by the user, never by
 * the app. Separate channels let someone silence fuel insights while keeping
 * document-expiry alerts loud, which is a real preference and one Android
 * expects apps to support.
 */
export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  for (const channel of CHANNEL_DEFINITIONS) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      description: channel.description,
      importance:
        channel.importance === 'high'
          ? Notifications.AndroidImportance.HIGH
          : Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      enableVibrate: true,
    });
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/**
 * Request notification permission.
 *
 * Call this only *after* the onboarding screen has explained what the app will
 * notify about. The OS prompt can only be shown once — a user who declines it
 * cold cannot be asked again from inside the app, only sent to Settings — so
 * spending the one attempt on an unexplained prompt is a permanent loss.
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!Device.isDevice) return 'denied';

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return 'granted';
  // Already explicitly denied: the OS will not re-prompt, so do not pretend.
  if (existing.status === 'denied' && !existing.canAskAgain) return 'denied';

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      // Quiet delivery for the less urgent reminders.
      provideAppNotificationSettings: true,
    },
  });
  return status as PermissionState;
}

export async function getPushToken(projectId: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

interface ScheduledRow {
  key: string;
  os_identifier: string;
  fire_at: string;
}

/**
 * Reconcile the OS's scheduled notifications with a freshly computed plan.
 *
 * Returns what actually changed, so the caller can log or surface it. Runs on
 * launch, after any data change that could move a due date, and from the
 * background task.
 */
export async function syncScheduledNotifications(
  input: PlannerInput,
): Promise<{ scheduled: number; cancelled: number; unchanged: number }> {
  const permission = await getPermissionState();
  if (permission !== 'granted') return { scheduled: 0, cancelled: 0, unchanged: 0 };

  const db = await getDatabase();
  const existing = await db.getAllAsync<ScheduledRow>('SELECT * FROM scheduled_notifications;');

  const plan = planNotifications(input);
  const diff = diffPlans(
    plan,
    existing.map((row) => ({ key: row.key, fireAt: row.fire_at })),
  );

  // Cancel first, so a rescheduled notification never briefly exists twice.
  for (const key of diff.toCancel) {
    const row = existing.find((r) => r.key === key);
    if (row) {
      await Notifications.cancelScheduledNotificationAsync(row.os_identifier).catch(
        () => undefined,
      );
      await db.runAsync('DELETE FROM scheduled_notifications WHERE key = ?;', [key]);
    }
  }

  for (const notification of diff.toSchedule) {
    const previous = existing.find((r) => r.key === notification.key);
    if (previous) {
      await Notifications.cancelScheduledNotificationAsync(previous.os_identifier).catch(
        () => undefined,
      );
    }
    const identifier = await scheduleOne(notification);
    if (!identifier) continue;

    await db.runAsync(
      `INSERT INTO scheduled_notifications (key, os_identifier, fire_at, kind, vehicle_id, source_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         os_identifier = excluded.os_identifier,
         fire_at = excluded.fire_at;`,
      [
        notification.key,
        identifier,
        notification.fireAt,
        notification.kind,
        notification.vehicleId ?? null,
        notification.sourceId,
      ],
    );
  }

  return {
    scheduled: diff.toSchedule.length,
    cancelled: diff.toCancel.length,
    unchanged: diff.unchanged.length,
  };
}

async function scheduleOne(notification: PlannedNotification): Promise<string | null> {
  const fireAt = new Date(notification.fireAt);
  // The planner already filters the past, but a slow launch can put a
  // notification behind us between planning and scheduling.
  if (fireAt.getTime() <= Date.now()) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        // Read back by the deep-link handler when the user taps.
        data: { deepLink: notification.deepLink, kind: notification.kind },
        ...(Platform.OS === 'android' ? { channelId: notification.channelId } : {}),
        ...(notification.severity === 'critical'
          ? { interruptionLevel: 'timeSensitive' as const }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  } catch {
    return null;
  }
}

/** Clear everything — used on sign-out so a signed-out device stays silent. */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scheduled_notifications;');
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count).catch(() => undefined);
}
