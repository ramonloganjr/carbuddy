-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "failedSignInCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" UUID NOT NULL,
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "volumeUnit" TEXT NOT NULL DEFAULT 'l',
    "economyStandard" TEXT NOT NULL DEFAULT 'km_l',
    "pressureUnit" TEXT NOT NULL DEFAULT 'kpa',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT,
    "dateFormat" TEXT NOT NULL DEFAULT 'system',
    "themeMode" TEXT NOT NULL DEFAULT 'system',
    "dynamicColour" BOOLEAN NOT NULL DEFAULT true,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "hapticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "biometricLock" BOOLEAN NOT NULL DEFAULT false,
    "notifications" JSONB NOT NULL,
    "defaultVehicleId" UUID,
    "onboardingCompletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "variant" TEXT,
    "modelYear" INTEGER,
    "bodyType" TEXT,
    "colour" TEXT,
    "engineType" TEXT,
    "engineDisplacementCc" INTEGER,
    "cylinders" INTEGER,
    "transmission" TEXT,
    "drivetrain" TEXT,
    "fuelType" TEXT,
    "fuelTankCapacityL" DECIMAL(6,2),
    "recommendedFuelGrade" TEXT,
    "batterySpecification" JSONB,
    "tyreSpecification" JSONB,
    "vinEncrypted" TEXT,
    "vinFingerprint" TEXT,
    "engineNumberEncrypted" TEXT,
    "plateNumber" TEXT,
    "registrationNumber" TEXT,
    "registrationCountry" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "purchasePrice" INTEGER,
    "purchaseOdometerKm" DECIMAL(10,1),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dealerName" TEXT,
    "dealerContact" TEXT,
    "financing" JSONB,
    "warranty" JSONB,
    "currentOdometerKm" DECIMAL(10,1) NOT NULL DEFAULT 0,
    "odometerUpdatedAt" TIMESTAMP(3),
    "photoAttachmentId" UUID,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odometer_readings" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "odometerKm" DECIMAL(10,1) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "odometer_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "filledAt" TIMESTAMP(3) NOT NULL,
    "odometerKm" DECIMAL(10,1) NOT NULL,
    "litres" DECIMAL(8,3) NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL DEFAULT 'gasoline',
    "fuelGrade" TEXT,
    "isFullTank" BOOLEAN NOT NULL DEFAULT true,
    "missedFill" BOOLEAN NOT NULL DEFAULT false,
    "stationName" TEXT,
    "stationBrand" TEXT,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "servicedAt" TIMESTAMP(3) NOT NULL,
    "odometerKm" DECIMAL(10,1) NOT NULL,
    "providerName" TEXT,
    "providerContact" TEXT,
    "partsCost" INTEGER NOT NULL DEFAULT 0,
    "labourCost" INTEGER NOT NULL DEFAULT 0,
    "taxCost" INTEGER NOT NULL DEFAULT 0,
    "totalCost" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "partsReplaced" TEXT[],
    "warrantyMonths" INTEGER,
    "warrantyDistanceKm" DECIMAL(10,1),
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceOdometerKm" DECIMAL(10,1),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intervalMonths" INTEGER,
    "intervalDistanceKm" DECIMAL(10,1),
    "lastServicedAt" TIMESTAMP(3),
    "lastServiceOdometerKm" DECIMAL(10,1),
    "leadTimeDays" INTEGER,
    "leadTimeKm" DECIMAL(10,1),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_components" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "specification" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "installedOdometerKm" DECIMAL(10,1) NOT NULL,
    "purchasePrice" INTEGER,
    "currency" TEXT,
    "expectedLifeMonths" INTEGER,
    "expectedLifeKm" DECIMAL(10,1),
    "warrantyExpiresAt" TIMESTAMP(3),
    "warrantyDistanceKm" DECIMAL(10,1),
    "rotationIntervalKm" DECIMAL(10,1),
    "lastRotatedOdometerKm" DECIMAL(10,1),
    "removedAt" TIMESTAMP(3),
    "removedOdometerKm" DECIMAL(10,1),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicle_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentNumberEncrypted" TEXT,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "reminderOffsetsDays" INTEGER[],
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "odometerKm" DECIMAL(10,1),
    "vendor" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" UUID,
    "recurrenceId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "dueOdometerKm" DECIMAL(10,1),
    "leadTimeDays" INTEGER,
    "repeatEveryDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pushToken" TEXT,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadState" TEXT NOT NULL DEFAULT 'pending',
    "fuelRecordId" UUID,
    "maintenanceRecordId" UUID,
    "documentId" UUID,
    "expenseId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mutationId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultVersion" INTEGER NOT NULL,

    CONSTRAINT "sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'driver',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_assignments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverUserId" UUID,
    "assignedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedUntil" TIMESTAMP(3),
    "costCentre" TEXT,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "vehicles_userId_deletedAt_idx" ON "vehicles"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicles_userId_archivedAt_idx" ON "vehicles"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "vehicles_vinFingerprint_idx" ON "vehicles"("vinFingerprint");

-- CreateIndex
CREATE INDEX "odometer_readings_vehicleId_recordedAt_idx" ON "odometer_readings"("vehicleId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_deletedAt_odometerKm_idx" ON "fuel_records"("vehicleId", "deletedAt", "odometerKm");

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_filledAt_idx" ON "fuel_records"("vehicleId", "filledAt" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_vehicleId_servicedAt_idx" ON "maintenance_records"("vehicleId", "servicedAt" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_vehicleId_category_servicedAt_idx" ON "maintenance_records"("vehicleId", "category", "servicedAt" DESC);

-- CreateIndex
CREATE INDEX "maintenance_schedules_vehicleId_enabled_deletedAt_idx" ON "maintenance_schedules"("vehicleId", "enabled", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicle_components_vehicleId_removedAt_deletedAt_idx" ON "vehicle_components"("vehicleId", "removedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "documents_expiresAt_reminderEnabled_deletedAt_idx" ON "documents"("expiresAt", "reminderEnabled", "deletedAt");

-- CreateIndex
CREATE INDEX "documents_userId_deletedAt_idx" ON "documents"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "documents_vehicleId_deletedAt_idx" ON "documents"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "expenses_vehicleId_incurredAt_idx" ON "expenses"("vehicleId", "incurredAt" DESC);

-- CreateIndex
CREATE INDEX "expenses_vehicleId_category_incurredAt_idx" ON "expenses"("vehicleId", "category", "incurredAt" DESC);

-- CreateIndex
CREATE INDEX "reminders_userId_enabled_dueAt_idx" ON "reminders"("userId", "enabled", "dueAt");

-- CreateIndex
CREATE INDEX "notifications_scheduledFor_sentAt_idx" ON "notifications"("scheduledFor", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_planKey_key" ON "notifications"("userId", "planKey");

-- CreateIndex
CREATE INDEX "devices_pushToken_idx" ON "devices"("pushToken");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_deviceId_key" ON "devices"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");

-- CreateIndex
CREATE INDEX "attachments_userId_deletedAt_idx" ON "attachments"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "sync_records_userId_appliedAt_idx" ON "sync_records"("userId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_records_userId_mutationId_key" ON "sync_records"("userId", "mutationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_organizationId_vehicleId_idx" ON "vehicle_assignments"("organizationId", "vehicleId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_components" ADD CONSTRAINT "vehicle_components_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_fuelRecordId_fkey" FOREIGN KEY ("fuelRecordId") REFERENCES "fuel_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "maintenance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
