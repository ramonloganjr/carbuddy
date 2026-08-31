import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  planNotifications,
  type NotificationPreferences,
  type PlannedNotification,
} from '@carbuddy/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PushService } from './push.service';

/**
 * Server-side reminder delivery.
 *
 * The mobile app schedules local notifications, which covers the common case
 * and works offline. This job covers the case local notifications cannot: a
 * user who has not opened the app in two months still needs to hear that their
 * insurance expires next week, and the OS will have long since exhausted the
 * pending notifications the app registered.
 *
 * It uses the same `planNotifications` from `@carbuddy/domain` the client uses,
 * so a reminder is never worded or timed differently depending on which side
 * delivered it. The `planKey` from that plan is stored with a unique
 * constraint, which makes the job safe to run twice — a retry after a partial
 * failure cannot double-send.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly push: PushService,
  ) {}

  /**
   * Rebuild each user's plan nightly.
   *
   * 02:00 UTC is chosen because the plan is only *computed* here — actual
   * delivery is governed by each user's own preferred hour and quiet hours,
   * which the domain planner applies using their stored timezone offset.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async rebuildPlans(): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    this.logger.log(`Rebuilding notification plans for ${users.length} users`);

    let planned = 0;
    for (const user of users) {
      try {
        planned += await this.rebuildForUser(user.id);
      } catch (error) {
        // One user's bad data must not stop the sweep for everyone else.
        this.logger.warn(`Planning failed for user ${user.id}: ${String(error)}`);
      }
    }

    this.logger.log(`Planned ${planned} notifications`);
  }

  async rebuildForUser(userId: string): Promise<number> {
    const [preferences, vehicles, reminders] = await Promise.all([
      this.prisma.userPreferences.findUnique({ where: { userId } }),
      this.prisma.vehicle.findMany({
        where: { userId, deletedAt: null, archivedAt: null },
        select: { id: true, nickname: true, make: true, model: true },
      }),
      this.prisma.reminder.findMany({
        where: { userId, deletedAt: null, enabled: true, completedAt: null },
      }),
    ]);

    const notificationPreferences =
      (preferences?.notifications as NotificationPreferences | null) ??
      DEFAULT_NOTIFICATION_PREFERENCES;

    if (!notificationPreferences.enabled) return 0;

    const vehicleInputs = [];
    for (const vehicle of vehicles) {
      const overview = await this.analytics.vehicleOverview(userId, vehicle.id);
      const documents = await this.prisma.document.findMany({
        where: {
          userId,
          deletedAt: null,
          reminderEnabled: true,
          OR: [{ vehicleId: vehicle.id }, { vehicleId: null }],
        },
      });

      vehicleInputs.push({
        id: vehicle.id,
        displayName: vehicle.nickname || `${vehicle.make} ${vehicle.model}`.trim(),
        schedules: overview.maintenance,
        components: overview.components,
        documents: overview.documents
          .map((evaluation) => {
            const row = documents.find((d) => d.id === evaluation.documentId);
            if (!row) return null;
            return {
              document: {
                id: row.id,
                userId: row.userId,
                ...(row.vehicleId ? { vehicleId: row.vehicleId } : {}),
                type: row.type as 'other',
                title: row.title,
                ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
                ...(row.reminderOffsetsDays.length > 0
                  ? { reminderOffsetsDays: row.reminderOffsetsDays }
                  : {}),
                reminderEnabled: row.reminderEnabled,
              },
              evaluation,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        fuelAnomaly: overview.fuel.anomaly,
      });
    }

    const plan = planNotifications({
      now: new Date(),
      preferences: notificationPreferences,
      vehicles: vehicleInputs,
      customReminders: reminders.map((reminder) => ({
        id: reminder.id,
        ...(reminder.vehicleId ? { vehicleId: reminder.vehicleId } : {}),
        title: reminder.title,
        ...(reminder.body ? { body: reminder.body } : {}),
        ...(reminder.dueAt ? { dueAt: reminder.dueAt.toISOString() } : {}),
        ...(reminder.leadTimeDays !== null ? { leadTimeDays: reminder.leadTimeDays } : {}),
        enabled: reminder.enabled,
      })),
    });

    await this.persistPlan(userId, plan);
    return plan.length;
  }

  /**
   * Store the plan, upserting on `planKey`.
   *
   * A notification whose key already exists is left alone if it has already
   * been sent — re-planning must never resurrect and resend something the user
   * already saw.
   */
  private async persistPlan(userId: string, plan: PlannedNotification[]): Promise<void> {
    for (const notification of plan) {
      await this.prisma.notification.upsert({
        where: { userId_planKey: { userId, planKey: notification.key } },
        create: {
          userId,
          planKey: notification.key,
          kind: notification.kind,
          severity: notification.severity,
          title: notification.title,
          body: notification.body,
          deepLink: notification.deepLink,
          channelId: notification.channelId,
          scheduledFor: new Date(notification.fireAt),
        },
        update: {
          // Only reschedule what has not gone out yet.
          scheduledFor: new Date(notification.fireAt),
          title: notification.title,
          body: notification.body,
        },
      });
    }
  }

  /**
   * Deliver anything due.
   *
   * Runs every fifteen minutes. Because the planner has already snapped each
   * notification to the user's preferred hour, a quarter-hour granularity is
   * plenty and keeps the job cheap.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async deliverDue(): Promise<void> {
    const due = await this.prisma.notification.findMany({
      where: { sentAt: null, scheduledFor: { lte: new Date() } },
      take: 500,
      orderBy: { scheduledFor: 'asc' },
    });

    if (due.length === 0) return;

    const devices = await this.prisma.device.findMany({
      where: {
        userId: { in: [...new Set(due.map((n) => n.userId))] },
        pushToken: { not: null },
        disabledAt: null,
      },
    });

    const tokensByUser = new Map<string, string[]>();
    for (const device of devices) {
      if (!device.pushToken) continue;
      const list = tokensByUser.get(device.userId) ?? [];
      list.push(device.pushToken);
      tokensByUser.set(device.userId, list);
    }

    for (const notification of due) {
      const tokens = tokensByUser.get(notification.userId) ?? [];

      if (tokens.length === 0) {
        // No registered device. Mark as sent anyway: the reminder is already
        // visible in the app, and leaving it pending forever would make the
        // due-query grow without bound.
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { sentAt: new Date(), failureReason: 'no_registered_device' },
        });
        continue;
      }

      const result = await this.push.send(tokens, {
        title: notification.title,
        body: notification.body,
        data: { deepLink: notification.deepLink, kind: notification.kind },
        channelId: notification.channelId,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          sentAt: new Date(),
          failureReason: result.ok ? null : result.reason,
        },
      });

      // A token the push service reports as dead belongs to an uninstalled app.
      for (const token of result.invalidTokens) {
        await this.prisma.device.updateMany({
          where: { pushToken: token },
          data: { disabledAt: new Date(), pushToken: null },
        });
      }
    }
  }
}
