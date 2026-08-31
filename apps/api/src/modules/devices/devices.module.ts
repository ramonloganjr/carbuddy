import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/current-user.decorator';

export class RegisterDeviceDto {
  @IsString() @MaxLength(64) deviceId!: string;
  @IsOptional() @IsString() @MaxLength(256) pushToken?: string;
  @IsString() @MaxLength(20) platform!: string;
  @IsOptional() @IsString() @MaxLength(40) osVersion?: string;
  @IsOptional() @IsString() @MaxLength(40) appVersion?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register or refresh a device's push token.
   *
   * Upserted on (user, device) so reinstalls and token rotations replace the
   * old row rather than accumulating stale tokens — every one of which would
   * otherwise be a duplicate notification.
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    // A token can migrate between users on a shared device; detach it from any
    // previous owner so the wrong person does not receive the notifications.
    if (dto.pushToken) {
      await this.prisma.device.updateMany({
        where: { pushToken: dto.pushToken, userId: { not: userId } },
        data: { pushToken: null, disabledAt: new Date() },
      });
    }

    return this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
      create: {
        userId,
        deviceId: dto.deviceId,
        pushToken: dto.pushToken ?? null,
        platform: dto.platform,
        osVersion: dto.osVersion ?? null,
        appVersion: dto.appVersion ?? null,
      },
      update: {
        pushToken: dto.pushToken ?? null,
        osVersion: dto.osVersion ?? null,
        appVersion: dto.appVersion ?? null,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
    });
  }

  async unregister(userId: string, deviceId: string): Promise<void> {
    await this.prisma.device.updateMany({
      where: { userId, deviceId },
      data: { pushToken: null, disabledAt: new Date() },
    });
  }
}

@ApiTags('devices')
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register this device for push notifications.' })
  register(@CurrentUser('userId') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(userId, dto);
  }

  @Delete(':deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop sending push notifications to this device.' })
  unregister(@CurrentUser('userId') userId: string, @Param('deviceId') deviceId: string) {
    return this.devices.unregister(userId, deviceId);
  }
}

@Module({
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
