import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { maskIdentifier, starterSchedules, validateVin } from '@carbuddy/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto.service';
import { toDecimal, toNumber } from '../../common/decimal';
import type { CreateVehicleDto, UpdateVehicleDto } from './vehicles.dto';

/**
 * Vehicle CRUD.
 *
 * Sensitive identifiers are encrypted on the way in and masked on the way out.
 * The unmasked value is only ever returned from the single-vehicle detail
 * endpoint, and never from a list — so a compromised session that scrapes the
 * list endpoint does not walk away with every VIN on the account.
 */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(userId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { nickname: 'asc' }],
    });

    return vehicles.map((vehicle) => ({
      ...this.toPublic(vehicle),
      vin: maskIdentifier(this.crypto.decrypt(vehicle.vinEncrypted), 'vin'),
      plateNumber: maskIdentifier(vehicle.plateNumber, 'plate'),
    }));
  }

  async findOne(userId: string, vehicleId: string, revealIdentifiers = false) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const vin = this.crypto.decrypt(vehicle.vinEncrypted);
    const engineNumber = this.crypto.decrypt(vehicle.engineNumberEncrypted);

    return {
      ...this.toPublic(vehicle),
      vin: revealIdentifiers ? vin : maskIdentifier(vin, 'vin'),
      engineNumber: revealIdentifiers ? engineNumber : maskIdentifier(engineNumber, 'engineNumber'),
      plateNumber: revealIdentifiers
        ? vehicle.plateNumber
        : maskIdentifier(vehicle.plateNumber, 'plate'),
    };
  }

  async create(userId: string, dto: CreateVehicleDto) {
    // A failing VIN checksum is a warning, not a rejection: several markets do
    // not follow ISO-3779, and refusing a legitimate VIN would be worse than
    // storing an unverified one.
    const vinWarning = dto.vin && !validateVin(dto.vin).valid ? 'vin_checksum_failed' : undefined;

    const fingerprint = this.crypto.fingerprint(dto.vin);
    if (fingerprint) {
      const duplicate = await this.prisma.vehicle.findFirst({
        where: { userId, vinFingerprint: fingerprint, deletedAt: null },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('You have already added a vehicle with that VIN.');
      }
    }

    const vehicleId = randomUUID();

    const vehicle = await this.prisma.$transaction(async (tx) => {
      // Only one vehicle can be primary; setting a new one demotes the rest.
      if (dto.isPrimary) {
        await tx.vehicle.updateMany({ where: { userId }, data: { isPrimary: false } });
      }

      const created = await tx.vehicle.create({
        data: {
          id: vehicleId,
          userId,
          nickname: dto.nickname,
          make: dto.make ?? '',
          model: dto.model ?? '',
          variant: dto.variant ?? null,
          modelYear: dto.modelYear ?? null,
          bodyType: dto.bodyType ?? null,
          colour: dto.colour ?? null,
          engineType: dto.engineType ?? null,
          engineDisplacementCc: dto.engineDisplacementCc ?? null,
          cylinders: dto.cylinders ?? null,
          transmission: dto.transmission ?? null,
          drivetrain: dto.drivetrain ?? null,
          fuelType: dto.fuelType ?? null,
          fuelTankCapacityL: toDecimal(dto.fuelTankCapacityL),
          vinEncrypted: this.crypto.encrypt(dto.vin),
          vinFingerprint: fingerprint,
          engineNumberEncrypted: this.crypto.encrypt(dto.engineNumber),
          plateNumber: dto.plateNumber ?? null,
          registrationNumber: dto.registrationNumber ?? null,
          registrationCountry: dto.registrationCountry ?? null,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
          purchasePrice: dto.purchasePrice ?? null,
          purchaseOdometerKm: toDecimal(dto.purchaseOdometerKm),
          currency: dto.currency ?? 'USD',
          currentOdometerKm: toDecimal(dto.currentOdometerKm) ?? undefined,
          odometerUpdatedAt: new Date(),
          isPrimary: dto.isPrimary ?? false,
        },
      });

      // Seed a starter schedule so reminders work before the user configures
      // anything. Same templates the app uses during onboarding.
      const profile =
        dto.engineType === 'diesel'
          ? 'diesel'
          : dto.engineType === 'electric'
            ? 'electric'
            : dto.engineType === 'hybrid'
              ? 'hybrid'
              : 'petrol';

      await tx.maintenanceSchedule.createMany({
        data: starterSchedules(profile).map((template) => ({
          id: randomUUID(),
          vehicleId,
          category: template.category,
          title: template.title,
          intervalMonths: template.intervalMonths ?? null,
          intervalDistanceKm: toDecimal(template.intervalDistanceKm),
          lastServicedAt: new Date(),
          lastServiceOdometerKm: toDecimal(dto.currentOdometerKm),
          enabled: true,
        })),
      });

      return created;
    });

    return { ...this.toPublic(vehicle), ...(vinWarning ? { warning: vinWarning } : {}) };
  }

  async update(userId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Vehicle not found.');

    if (dto.version !== undefined && dto.version !== existing.version) {
      throw new ConflictException({
        message: 'This vehicle was changed somewhere else. Refresh and try again.',
        details: { serverVersion: existing.version },
      });
    }

    const vehicle = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.vehicle.updateMany({
          where: { userId, id: { not: vehicleId } },
          data: { isPrimary: false },
        });
      }

      return tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
          ...(dto.make !== undefined ? { make: dto.make } : {}),
          ...(dto.model !== undefined ? { model: dto.model } : {}),
          ...(dto.variant !== undefined ? { variant: dto.variant } : {}),
          ...(dto.modelYear !== undefined ? { modelYear: dto.modelYear } : {}),
          ...(dto.colour !== undefined ? { colour: dto.colour } : {}),
          ...(dto.engineType !== undefined ? { engineType: dto.engineType } : {}),
          ...(dto.fuelTankCapacityL !== undefined
            ? { fuelTankCapacityL: toDecimal(dto.fuelTankCapacityL) }
            : {}),
          ...(dto.vin !== undefined
            ? {
                vinEncrypted: this.crypto.encrypt(dto.vin),
                vinFingerprint: this.crypto.fingerprint(dto.vin),
              }
            : {}),
          ...(dto.engineNumber !== undefined
            ? { engineNumberEncrypted: this.crypto.encrypt(dto.engineNumber) }
            : {}),
          ...(dto.plateNumber !== undefined ? { plateNumber: dto.plateNumber } : {}),
          ...(dto.currentOdometerKm !== undefined
            ? {
                currentOdometerKm: toDecimal(dto.currentOdometerKm) ?? undefined,
                odometerUpdatedAt: new Date(),
              }
            : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          version: { increment: 1 },
        },
      });
    });

    return this.toPublic(vehicle);
  }

  /** Soft delete, so the removal can reach every offline device. */
  async remove(userId: string, vehicleId: string): Promise<void> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found.');

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  /** Strip encrypted columns; identifiers are added back by the caller. */
  private toPublic(vehicle: {
    id: string;
    userId: string;
    nickname: string;
    make: string;
    model: string;
    variant: string | null;
    modelYear: number | null;
    bodyType: string | null;
    colour: string | null;
    engineType: string | null;
    currency: string;
    currentOdometerKm: unknown;
    odometerUpdatedAt: Date | null;
    isPrimary: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    fuelTankCapacityL: unknown;
  }) {
    return {
      id: vehicle.id,
      userId: vehicle.userId,
      nickname: vehicle.nickname,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      modelYear: vehicle.modelYear,
      bodyType: vehicle.bodyType,
      colour: vehicle.colour,
      engineType: vehicle.engineType,
      currency: vehicle.currency,
      fuelTankCapacityL: toNumber(vehicle.fuelTankCapacityL as never),
      currentOdometerKm: toNumber(vehicle.currentOdometerKm as never),
      odometerUpdatedAt: vehicle.odometerUpdatedAt?.toISOString() ?? null,
      isPrimary: vehicle.isPrimary,
      version: vehicle.version,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    };
  }
}
