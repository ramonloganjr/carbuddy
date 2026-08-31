import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/current-user.decorator';
import { SyncPushDto } from './sync.dto';
import { SyncService, type MutationResult } from './sync.service';

@ApiTags('sync')
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply queued offline mutations.',
    description:
      'Idempotent by mutation id. Each result is applied, duplicate, conflict or rejected; ' +
      'a conflict carries the server copy so the client can three-way merge.',
  })
  push(@CurrentUser('userId') userId: string, @Body() dto: SyncPushDto): Promise<MutationResult[]> {
    return this.syncService.push(userId, dto.deviceId, dto.mutations);
  }

  @Get('pull')
  @ApiOperation({
    summary: 'Fetch everything changed since a cursor.',
    description:
      'Returns a new cursor and whether more pages remain. Callers should keep pulling ' +
      'while hasMore is true.',
  })
  pull(@CurrentUser('userId') userId: string, @Query('since') since?: string) {
    return this.syncService.pull(userId, since);
  }
}
