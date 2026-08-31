import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client as a Nest provider.
 *
 * Connecting explicitly on module init rather than lazily on first query means
 * a bad `DATABASE_URL` surfaces at boot — where a deployment health check will
 * catch it — instead of as a 500 on the first user request after a release.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Soft-delete filter shared by every read path.
   *
   * Centralised because forgetting it in one query silently resurrects deleted
   * records — and a deleted vehicle reappearing in someone's garage is both a
   * bug and a trust problem.
   */
  static readonly notDeleted = { deletedAt: null } as const;
}
