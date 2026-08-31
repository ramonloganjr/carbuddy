import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/jwt-auth.guard';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness: is the process up?
   *
   * Deliberately checks nothing external. A liveness probe that fails when the
   * database is briefly unavailable makes the orchestrator kill and restart
   * healthy pods, turning a short database blip into a full outage.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe.' })
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  /** Readiness: can this instance actually serve traffic? */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies the database is reachable.' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
