import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FuelEconomyStandard } from '@carbuddy/domain';
import { CurrentUser } from '../../common/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('vehicles/:vehicleId')
  @ApiOperation({
    summary: 'Full analytics for one vehicle.',
    description:
      'Fuel statistics, ownership costs, service status, component wear, health score and ' +
      'ownership insights — all computed with the same domain functions the app runs locally.',
  })
  overview(
    @CurrentUser('userId') userId: string,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query('economy') economy?: FuelEconomyStandard,
  ) {
    return this.analytics.vehicleOverview(userId, vehicleId, economy ?? 'km_l');
  }
}
