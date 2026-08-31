import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/current-user.decorator';
import { CreateVehicleDto, UpdateVehicleDto } from './vehicles.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller({ path: 'vehicles', version: '1' })
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List vehicles. Identifiers are masked.' })
  list(@CurrentUser('userId') userId: string) {
    return this.vehicles.list(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one vehicle.',
    description:
      'Pass `reveal=true` to receive unmasked VIN, engine and plate numbers. The client ' +
      'requests this only on an explicit user tap, never to render a list.',
  })
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('reveal') reveal?: string,
  ) {
    return this.vehicles.findOne(userId, id, reveal === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Add a vehicle and seed its starter service schedule.' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vehicle. Send `version` for concurrency safety.' })
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a vehicle and everything attached to it.' })
  remove(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.remove(userId, id);
  }
}
