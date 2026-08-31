import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @Length(1, 80)
  nickname!: string;

  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @IsString() @MaxLength(60) variant?: string;

  @IsOptional()
  @IsInt()
  // Upper bound allows next-model-year vehicles, which go on sale early.
  @Min(1900)
  @Max(new Date().getFullYear() + 2)
  @Type(() => Number)
  modelYear?: number;

  @IsOptional() @IsString() @MaxLength(30) bodyType?: string;
  @IsOptional() @IsString() @MaxLength(40) colour?: string;
  @IsOptional() @IsString() @MaxLength(30) engineType?: string;

  @IsOptional() @IsInt() @Min(0) @Max(20000) @Type(() => Number) engineDisplacementCc?: number;
  @IsOptional() @IsInt() @Min(0) @Max(16) @Type(() => Number) cylinders?: number;

  @IsOptional() @IsString() @MaxLength(20) transmission?: string;
  @IsOptional() @IsString() @MaxLength(10) drivetrain?: string;
  @IsOptional() @IsString() @MaxLength(20) fuelType?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1000) @Type(() => Number) fuelTankCapacityL?: number;

  /** Stored encrypted. Validated for shape, never logged. */
  @IsOptional() @IsString() @Length(11, 17) vin?: string;
  @IsOptional() @IsString() @MaxLength(40) engineNumber?: string;
  @IsOptional() @IsString() @MaxLength(20) plateNumber?: string;
  @IsOptional() @IsString() @MaxLength(40) registrationNumber?: string;
  @IsOptional() @IsString() @Length(2, 2) registrationCountry?: string;

  @IsOptional() @IsISO8601() purchasedAt?: string;
  /** Minor currency units. */
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) purchasePrice?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) purchaseOdometerKm?: number;

  @IsOptional() @IsString() @Length(3, 3) currency?: string;

  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  currentOdometerKm!: number;

  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateVehicleDto extends CreateVehicleDto {
  @IsOptional()
  @IsString()
  declare nickname: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  declare currentOdometerKm: number;

  /**
   * The version the client is editing against, for optimistic concurrency.
   * Omitting it opts out of the check — acceptable for a single-client web
   * caller, never for the mobile app, which always supplies it.
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  version?: number;
}
