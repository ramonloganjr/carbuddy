import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const SYNC_ENTITIES = [
  'vehicle',
  'fuel_record',
  'maintenance_record',
  'maintenance_schedule',
  'vehicle_component',
  'document',
  'expense',
  'reminder',
  'odometer_reading',
  'user_preferences',
] as const;

export type SyncEntityName = (typeof SYNC_ENTITIES)[number];

export class MutationDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsIn(SYNC_ENTITIES)
  entity!: SyncEntityName;

  @IsUUID()
  entityId!: string;

  @IsIn(['create', 'update', 'delete'])
  operation!: 'create' | 'update' | 'delete';

  @IsObject()
  payload!: Record<string, unknown>;

  /**
   * The version the client edited against. `0` means "created offline, the
   * server has never seen this". Anything else is checked for concurrent edits.
   */
  @IsInt()
  @Min(0)
  baseVersion!: number;

  @IsString()
  createdAt!: string;

  @IsString()
  @MaxLength(64)
  deviceId!: string;
}

export class SyncPushDto {
  @IsString()
  @MaxLength(64)
  deviceId!: string;

  /**
   * Capped at 200. A single request that tries to apply thousands of mutations
   * holds a transaction open long enough to matter; the client's queue drains
   * across several batches instead.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MutationDto)
  mutations!: MutationDto[];

  @IsOptional()
  @IsString()
  since?: string;
}
