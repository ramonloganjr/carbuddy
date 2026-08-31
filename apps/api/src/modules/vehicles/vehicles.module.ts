import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { CryptoService } from '../../common/crypto.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, CryptoService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
