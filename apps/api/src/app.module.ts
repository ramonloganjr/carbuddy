import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadConfiguration } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { SyncModule } from './modules/sync/sync.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfiguration],
      cache: true,
    }),

    /**
     * Rate limiting applied globally.
     *
     * Two tiers: a burst allowance that stops a runaway client hammering the
     * API in a loop, and a sustained limit for normal traffic. Auth endpoints
     * tighten this further with their own `@Throttle` decorators.
     */
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 10 },
      { name: 'sustained', ttl: 60_000, limit: 120 },
    ]),

    ScheduleModule.forRoot(),
    PrismaModule,

    AuthModule,
    VehiclesModule,
    SyncModule,
    AnalyticsModule,
    NotificationsModule,
    AttachmentsModule,
    DevicesModule,
    HealthModule,
  ],
  providers: [
    // Authentication before rate limiting, so a per-user limit can be applied.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
