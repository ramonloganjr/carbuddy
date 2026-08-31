import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { MutationDto, SyncEntityName } from './sync.dto';

/**
 * Server-side sync.
 *
 * Three properties this has to guarantee, in order of how badly things break
 * without them:
 *
 *   1. **Idempotency.** Mobile requests fail after the server has committed far
 *      more often than people expect. Every applied mutation is recorded by its
 *      client-generated id, so a retry returns `duplicate` instead of creating a
 *      second fill-up.
 *
 *   2. **Optimistic concurrency.** The client sends the version it edited
 *      against. If the row has moved on, the mutation is rejected as a conflict
 *      and the server's copy is returned, so the client can three-way merge.
 *      Blind writes would silently discard whichever device synced first.
 *
 *   3. **Ownership.** Every write is scoped to the authenticated user. Ids are
 *      client-generated, so an id alone is never treated as authorisation.
 */

const MAX_MUTATIONS_PER_REQUEST = 200;

/** Columns a client may never set directly. */
const PROTECTED_COLUMNS = new Set([
  'version',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'userId',
  'user_id',
  'id',
]);

export type MutationResult =
  | { mutationId: string; status: 'applied'; record: Record<string, unknown> }
  | { mutationId: string; status: 'duplicate'; record: Record<string, unknown> }
  | {
      mutationId: string;
      status: 'conflict';
      server: Record<string, unknown>;
      conflictedFields: string[];
    }
  | { mutationId: string; status: 'rejected'; reason: string };

interface EntityConfig {
  /** Prisma delegate name. */
  model: Prisma.ModelName;
  /** How a row is tied back to the authenticated user. */
  ownership: 'user' | 'vehicle';
  /** snake_case column -> Prisma field. */
  fieldMap: Record<string, string>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async push(
    userId: string,
    deviceId: string,
    mutations: MutationDto[],
  ): Promise<MutationResult[]> {
    if (mutations.length > MAX_MUTATIONS_PER_REQUEST) {
      throw new BadRequestException(
        `Send at most ${MAX_MUTATIONS_PER_REQUEST} mutations per request.`,
      );
    }

    const results: MutationResult[] = [];

    // Sequential, not parallel: two mutations in one batch can touch the same
    // row (create then update), and applying them concurrently would race.
    for (const mutation of mutations) {
      try {
        results.push(await this.applyOne(userId, deviceId, mutation));
      } catch (error) {
        this.logger.warn(`Mutation ${mutation.id} (${mutation.entity}) failed: ${String(error)}`);
        results.push({
          mutationId: mutation.id,
          status: 'rejected',
          reason: error instanceof Error ? error.message : 'Could not apply that change.',
        });
      }
    }

    return results;
  }

  private async applyOne(
    userId: string,
    deviceId: string,
    mutation: MutationDto,
  ): Promise<MutationResult> {
    // Idempotency check first: cheapest path, and the one a retry takes.
    const alreadyApplied = await this.prisma.syncRecord.findUnique({
      where: { userId_mutationId: { userId, mutationId: mutation.id } },
    });

    if (alreadyApplied) {
      const record = await this.readRecord(mutation.entity, alreadyApplied.entityId, userId);
      return record
        ? { mutationId: mutation.id, status: 'duplicate', record }
        : { mutationId: mutation.id, status: 'rejected', reason: 'Record no longer exists.' };
    }

    const config = ENTITY_CONFIG[mutation.entity];
    if (!config) {
      return { mutationId: mutation.id, status: 'rejected', reason: 'Unknown entity type.' };
    }

    const existing = await this.readRecord(mutation.entity, mutation.entityId, userId);

    // Concurrent-edit check. A create (`baseVersion` 0) against a row that
    // already exists is treated as a conflict too — that is a re-created id,
    // and overwriting would lose whatever is already there.
    if (existing && mutation.baseVersion !== (existing.version as number)) {
      return {
        mutationId: mutation.id,
        status: 'conflict',
        server: existing,
        conflictedFields: Object.keys(mutation.payload).filter(
          (key) => !PROTECTED_COLUMNS.has(key),
        ),
      };
    }

    if (!existing && mutation.operation === 'update') {
      return {
        mutationId: mutation.id,
        status: 'rejected',
        reason: 'That record no longer exists on the server.',
      };
    }

    const data = this.mapPayload(config, mutation.payload);
    await this.assertOwnership(config, userId, mutation.entityId, data);

    const record = await this.prisma.$transaction(async (tx) => {
      const delegate = this.delegateFor(tx, config.model);

      let written: Record<string, unknown>;

      if (mutation.operation === 'delete') {
        written = (await delegate.update({
          where: { id: mutation.entityId },
          data: { deletedAt: new Date(), version: { increment: 1 } },
        })) as Record<string, unknown>;
      } else if (existing) {
        written = (await delegate.update({
          where: { id: mutation.entityId },
          data: { ...data, version: { increment: 1 } },
        })) as Record<string, unknown>;
      } else {
        written = (await delegate.create({
          data: {
            ...data,
            id: mutation.entityId,
            ...(config.ownership === 'user' ? { userId } : {}),
            version: 1,
          },
        })) as Record<string, unknown>;
      }

      // Written in the same transaction as the change itself. If the ledger
      // entry were committed separately and the request then failed, a retry
      // would be treated as new and applied twice.
      await tx.syncRecord.create({
        data: {
          userId,
          mutationId: mutation.id,
          entity: mutation.entity,
          entityId: mutation.entityId,
          operation: mutation.operation,
          deviceId,
          resultVersion: (written.version as number) ?? 1,
        },
      });

      return written;
    });

    return { mutationId: mutation.id, status: 'applied', record: serialise(record) };
  }

  /**
   * Everything that changed since `cursor`, across every entity.
   *
   * The cursor is `updatedAt`. Rows are returned inclusive of the cursor
   * instant and de-duplicated by the client, because two rows can share a
   * millisecond and an exclusive cursor would skip one of them forever.
   */
  async pull(
    userId: string,
    cursor: string | undefined,
    limit = 500,
  ): Promise<{
    changes: { entity: SyncEntityName; records: Record<string, unknown>[] }[];
    cursor: string;
    hasMore: boolean;
  }> {
    const since = cursor ? new Date(cursor) : new Date(0);
    if (Number.isNaN(since.getTime())) {
      throw new BadRequestException('Invalid sync cursor.');
    }

    const vehicleIds = (
      await this.prisma.vehicle.findMany({ where: { userId }, select: { id: true } })
    ).map((vehicle) => vehicle.id);

    const changes: { entity: SyncEntityName; records: Record<string, unknown>[] }[] = [];
    let latest = since;
    let hasMore = false;

    for (const entity of Object.keys(ENTITY_CONFIG) as SyncEntityName[]) {
      const config = ENTITY_CONFIG[entity];
      if (!config) continue;

      const delegate = this.delegateFor(this.prisma, config.model);
      const where =
        config.ownership === 'user'
          ? { userId, updatedAt: { gte: since } }
          : { vehicleId: { in: vehicleIds }, updatedAt: { gte: since } };

      const rows = (await delegate.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        take: limit,
      })) as Record<string, unknown>[];

      if (rows.length === limit) hasMore = true;
      if (rows.length === 0) continue;

      for (const row of rows) {
        const updatedAt = row.updatedAt as Date;
        if (updatedAt > latest) latest = updatedAt;
      }

      changes.push({ entity, records: rows.map(serialise) });
    }

    return { changes, cursor: latest.toISOString(), hasMore };
  }

  private async readRecord(
    entity: SyncEntityName,
    id: string,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const config = ENTITY_CONFIG[entity];
    if (!config) return null;

    const delegate = this.delegateFor(this.prisma, config.model);
    const row = (await delegate.findUnique({ where: { id } })) as Record<string, unknown> | null;
    if (!row) return null;

    // Ownership is verified on read as well as write, so a client cannot probe
    // for the existence of another account's record by id.
    if (config.ownership === 'user') {
      if (row.userId !== userId) return null;
    } else {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: row.vehicleId as string, userId },
        select: { id: true },
      });
      if (!vehicle) return null;
    }

    return serialise(row);
  }

  /** A vehicle-owned row may only be attached to a vehicle the user owns. */
  private async assertOwnership(
    config: EntityConfig,
    userId: string,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (config.ownership !== 'vehicle') return;

    const vehicleId = data.vehicleId as string | undefined;
    if (!vehicleId) return;

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { id: true },
    });
    if (!vehicle) {
      throw new BadRequestException('That vehicle does not exist on this account.');
    }
    void entityId;
  }

  /**
   * Translate the client's snake_case payload into Prisma fields, dropping
   * anything not on the allow-list.
   *
   * An allow-list rather than a deny-list: a new column added to the schema is
   * then un-writable by clients until it is deliberately exposed, instead of
   * being writable by default the moment it appears.
   */
  private mapPayload(
    config: EntityConfig,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (PROTECTED_COLUMNS.has(key)) continue;
      const field = config.fieldMap[key];
      if (!field) continue;
      data[field] = normaliseValue(field, value);
    }

    return data;
  }

  private delegateFor(
    client: PrismaService | Prisma.TransactionClient,
    model: Prisma.ModelName,
  ): PrismaDelegate {
    const key = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof typeof client;
    return client[key] as unknown as PrismaDelegate;
  }
}

interface PrismaDelegate {
  findUnique(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
}

/** Date-ish fields the client sends as ISO strings and Prisma wants as Dates. */
const DATE_FIELDS = new Set([
  'filledAt',
  'servicedAt',
  'incurredAt',
  'recordedAt',
  'installedAt',
  'removedAt',
  'issuedAt',
  'expiresAt',
  'archivedAt',
  'purchasedAt',
  'odometerUpdatedAt',
  'lastServicedAt',
  'nextServiceDate',
  'warrantyExpiresAt',
  'dueAt',
  'completedAt',
  'deletedAt',
  'onboardingCompletedAt',
]);

function normaliseValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (DATE_FIELDS.has(field) && typeof value === 'string') return new Date(value);
  // SQLite has no boolean; the client sends 0/1 for flags.
  if (typeof value === 'number' && BOOLEAN_FIELDS.has(field)) return value === 1;
  return value;
}

const BOOLEAN_FIELDS = new Set([
  'isFullTank',
  'missedFill',
  'enabled',
  'reminderEnabled',
  'isPrimary',
  'dynamicColour',
  'reduceMotion',
  'hapticsEnabled',
  'biometricLock',
]);

/** Prisma `Decimal` and `Date` are not JSON-serialisable in a stable way. */
function serialise(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = value.toISOString();
    else if (value !== null && typeof value === 'object' && 'toNumber' in value) {
      out[key] = (value as { toNumber: () => number }).toNumber();
    } else out[key] = value;
  }
  return out;
}

/**
 * Per-entity write allow-lists.
 *
 * The keys are the snake_case column names the mobile SQLite layer produces;
 * the values are Prisma fields. Anything absent is silently ignored rather than
 * rejected, so an older client sending a column a newer server dropped still
 * syncs the rest of its payload instead of failing outright.
 */
const ENTITY_CONFIG: Partial<Record<SyncEntityName, EntityConfig>> = {
  vehicle: {
    model: 'Vehicle',
    ownership: 'user',
    fieldMap: {
      nickname: 'nickname',
      make: 'make',
      model: 'model',
      variant: 'variant',
      model_year: 'modelYear',
      body_type: 'bodyType',
      colour: 'colour',
      engine_type: 'engineType',
      engine_displacement_cc: 'engineDisplacementCc',
      cylinders: 'cylinders',
      transmission: 'transmission',
      drivetrain: 'drivetrain',
      fuel_type: 'fuelType',
      fuel_tank_capacity_l: 'fuelTankCapacityL',
      recommended_fuel_grade: 'recommendedFuelGrade',
      plate_number: 'plateNumber',
      registration_number: 'registrationNumber',
      registration_country: 'registrationCountry',
      purchased_at: 'purchasedAt',
      purchase_price: 'purchasePrice',
      purchase_odometer_km: 'purchaseOdometerKm',
      currency: 'currency',
      dealer_name: 'dealerName',
      dealer_contact: 'dealerContact',
      current_odometer_km: 'currentOdometerKm',
      odometer_updated_at: 'odometerUpdatedAt',
      photo_attachment_id: 'photoAttachmentId',
      is_primary: 'isPrimary',
      archived_at: 'archivedAt',
      deleted_at: 'deletedAt',
    },
  },
  fuel_record: {
    model: 'FuelRecord',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      filled_at: 'filledAt',
      odometer_km: 'odometerKm',
      litres: 'litres',
      total_cost: 'totalCost',
      currency: 'currency',
      fuel_type: 'fuelType',
      fuel_grade: 'fuelGrade',
      is_full_tank: 'isFullTank',
      missed_fill: 'missedFill',
      station_name: 'stationName',
      station_brand: 'stationBrand',
      payment_method: 'paymentMethod',
      notes: 'notes',
      deleted_at: 'deletedAt',
    },
  },
  maintenance_record: {
    model: 'MaintenanceRecord',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      category: 'category',
      title: 'title',
      serviced_at: 'servicedAt',
      odometer_km: 'odometerKm',
      provider_name: 'providerName',
      provider_contact: 'providerContact',
      parts_cost: 'partsCost',
      labour_cost: 'labourCost',
      tax_cost: 'taxCost',
      total_cost: 'totalCost',
      currency: 'currency',
      warranty_months: 'warrantyMonths',
      warranty_distance_km: 'warrantyDistanceKm',
      next_service_date: 'nextServiceDate',
      next_service_odometer: 'nextServiceOdometerKm',
      notes: 'notes',
      deleted_at: 'deletedAt',
    },
  },
  maintenance_schedule: {
    model: 'MaintenanceSchedule',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      category: 'category',
      title: 'title',
      interval_months: 'intervalMonths',
      interval_distance_km: 'intervalDistanceKm',
      last_serviced_at: 'lastServicedAt',
      last_service_odometer: 'lastServiceOdometerKm',
      lead_time_days: 'leadTimeDays',
      lead_time_km: 'leadTimeKm',
      enabled: 'enabled',
      notes: 'notes',
      deleted_at: 'deletedAt',
    },
  },
  vehicle_component: {
    model: 'VehicleComponent',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      kind: 'kind',
      label: 'label',
      brand: 'brand',
      model: 'model',
      specification: 'specification',
      installed_at: 'installedAt',
      installed_odometer_km: 'installedOdometerKm',
      purchase_price: 'purchasePrice',
      currency: 'currency',
      expected_life_months: 'expectedLifeMonths',
      expected_life_km: 'expectedLifeKm',
      warranty_expires_at: 'warrantyExpiresAt',
      warranty_distance_km: 'warrantyDistanceKm',
      rotation_interval_km: 'rotationIntervalKm',
      last_rotated_odometer: 'lastRotatedOdometerKm',
      removed_at: 'removedAt',
      removed_odometer_km: 'removedOdometerKm',
      notes: 'notes',
      deleted_at: 'deletedAt',
    },
  },
  document: {
    model: 'Document',
    ownership: 'user',
    fieldMap: {
      vehicle_id: 'vehicleId',
      type: 'type',
      title: 'title',
      issuer: 'issuer',
      issued_at: 'issuedAt',
      expires_at: 'expiresAt',
      notes: 'notes',
      reminder_enabled: 'reminderEnabled',
      archived_at: 'archivedAt',
      deleted_at: 'deletedAt',
    },
  },
  expense: {
    model: 'Expense',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      category: 'category',
      title: 'title',
      amount: 'amount',
      currency: 'currency',
      incurred_at: 'incurredAt',
      odometer_km: 'odometerKm',
      vendor: 'vendor',
      notes: 'notes',
      source: 'source',
      source_id: 'sourceId',
      deleted_at: 'deletedAt',
    },
  },
  reminder: {
    model: 'Reminder',
    ownership: 'user',
    fieldMap: {
      vehicle_id: 'vehicleId',
      title: 'title',
      body: 'body',
      due_at: 'dueAt',
      due_odometer_km: 'dueOdometerKm',
      lead_time_days: 'leadTimeDays',
      repeat_every_days: 'repeatEveryDays',
      enabled: 'enabled',
      completed_at: 'completedAt',
      deleted_at: 'deletedAt',
    },
  },
  odometer_reading: {
    model: 'OdometerReading',
    ownership: 'vehicle',
    fieldMap: {
      vehicle_id: 'vehicleId',
      odometer_km: 'odometerKm',
      recorded_at: 'recordedAt',
      source: 'source',
      source_id: 'sourceId',
      notes: 'notes',
      deleted_at: 'deletedAt',
    },
  },
};
