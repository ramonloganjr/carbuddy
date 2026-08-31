import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { defaultPreferences, starterSchedules, toMinorUnits, toKilometres } from '@carbuddy/domain';

/**
 * Development seed.
 *
 * Produces a demo account with a year of plausible fuel history — enough for
 * the trend charts, the efficiency baseline and the anomaly detector to all
 * have something real to work with. Seeding two clean records would leave every
 * analytics screen in its empty state and make them impossible to review.
 */

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@carbuddy.app';
const DEMO_PASSWORD = 'carbuddy-demo-2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  console.log('Seeding demo data…');

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const userId = randomUUID();
  const preferences = defaultPreferences({ userId, regionCode: 'US', currency: 'USD' });

  await prisma.user.create({
    data: {
      id: userId,
      email: DEMO_EMAIL,
      passwordHash: await hash(DEMO_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
      displayName: 'Demo Driver',
      emailVerifiedAt: new Date(),
      preferences: {
        create: {
          distanceUnit: preferences.distanceUnit,
          volumeUnit: preferences.volumeUnit,
          economyStandard: preferences.economyStandard,
          pressureUnit: preferences.pressureUnit,
          currency: preferences.currency,
          dateFormat: preferences.dateFormat,
          themeMode: preferences.themeMode,
          dynamicColour: preferences.dynamicColour,
          reduceMotion: preferences.reduceMotion,
          hapticsEnabled: preferences.hapticsEnabled,
          biometricLock: preferences.biometricLockEnabled,
          notifications: preferences.notifications as unknown as object,
          onboardingCompletedAt: new Date(),
        },
      },
    },
  });

  const vehicleId = randomUUID();
  const startOdometerKm = toKilometres(41_200, 'mi');

  await prisma.vehicle.create({
    data: {
      id: vehicleId,
      userId,
      nickname: 'The Commuter',
      make: 'Toyota',
      model: 'Corolla',
      variant: '1.8 Hybrid',
      modelYear: 2021,
      bodyType: 'sedan',
      colour: 'Silver',
      engineType: 'hybrid',
      engineDisplacementCc: 1798,
      cylinders: 4,
      transmission: 'cvt',
      drivetrain: 'fwd',
      fuelType: 'gasoline',
      fuelTankCapacityL: 43,
      plateNumber: 'CBD 4210',
      currency: 'USD',
      purchasedAt: new Date('2022-03-14T00:00:00Z'),
      purchasePrice: toMinorUnits(24_500, 'USD'),
      purchaseOdometerKm: toKilometres(12, 'mi'),
      currentOdometerKm: startOdometerKm,
      odometerUpdatedAt: new Date(),
      isPrimary: true,
    },
  });

  // ---- Fuel history -------------------------------------------------------
  // Twenty-six fill-ups over a year, with mild variation and a deliberate
  // efficiency dip in the last few so the anomaly detector has something to
  // find during development.
  let odometerKm = startOdometerKm;
  const now = Date.now();

  for (let index = 25; index >= 0; index -= 1) {
    const filledAt = new Date(now - index * 14 * 86_400_000);
    const distanceKm = 480 + ((index * 37) % 90);
    odometerKm += distanceKm;

    const worseningTail = index <= 2 ? 1.22 : 1;
    const seasonal = 1 + Math.sin(index / 4) * 0.05;
    const litres = Number(((distanceKm / 18.5) * worseningTail * seasonal).toFixed(2));
    const pricePerLitre = 1.32 + (index % 7) * 0.03;

    await prisma.fuelRecord.create({
      data: {
        id: randomUUID(),
        vehicleId,
        filledAt,
        odometerKm,
        litres,
        totalCost: toMinorUnits(litres * pricePerLitre, 'USD'),
        currency: 'USD',
        fuelType: 'gasoline',
        isFullTank: true,
        stationName: ['Shell', 'BP', 'Costco', 'Chevron'][index % 4] ?? 'Shell',
      },
    });
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { currentOdometerKm: odometerKm, odometerUpdatedAt: new Date() },
  });

  // ---- Service history and schedules -------------------------------------
  await prisma.maintenanceRecord.createMany({
    data: [
      {
        id: randomUUID(),
        vehicleId,
        category: 'engine_oil',
        title: 'Engine oil & filter',
        servicedAt: new Date(now - 200 * 86_400_000),
        odometerKm: odometerKm - 9_800,
        providerName: 'Toyota of Downtown',
        partsCost: toMinorUnits(48, 'USD'),
        labourCost: toMinorUnits(60, 'USD'),
        taxCost: toMinorUnits(9.72, 'USD'),
        totalCost: toMinorUnits(117.72, 'USD'),
        currency: 'USD',
      },
      {
        id: randomUUID(),
        vehicleId,
        category: 'tyres',
        title: 'Four Michelin Primacy 4',
        servicedAt: new Date(now - 400 * 86_400_000),
        odometerKm: odometerKm - 19_500,
        providerName: 'Discount Tire',
        partsCost: toMinorUnits(612, 'USD'),
        labourCost: toMinorUnits(80, 'USD'),
        taxCost: toMinorUnits(55.36, 'USD'),
        totalCost: toMinorUnits(747.36, 'USD'),
        currency: 'USD',
      },
      {
        id: randomUUID(),
        vehicleId,
        category: 'brake_pads',
        title: 'Front brake pads',
        servicedAt: new Date(now - 90 * 86_400_000),
        odometerKm: odometerKm - 4_100,
        providerName: 'Midas',
        partsCost: toMinorUnits(96, 'USD'),
        labourCost: toMinorUnits(140, 'USD'),
        taxCost: toMinorUnits(18.88, 'USD'),
        totalCost: toMinorUnits(254.88, 'USD'),
        currency: 'USD',
      },
    ],
  });

  await prisma.maintenanceSchedule.createMany({
    data: starterSchedules('hybrid').map((template) => ({
      id: randomUUID(),
      vehicleId,
      category: template.category,
      title: template.title,
      intervalMonths: template.intervalMonths ?? null,
      intervalDistanceKm: template.intervalDistanceKm ?? null,
      // Anchored well in the past so several schedules read as due or overdue,
      // which is what the "needs attention" UI needs in order to be reviewable.
      lastServicedAt: new Date(now - 210 * 86_400_000),
      lastServiceOdometerKm: odometerKm - 10_400,
      enabled: true,
    })),
  });

  // ---- Wear items ---------------------------------------------------------
  await prisma.vehicleComponent.createMany({
    data: [
      {
        id: randomUUID(),
        vehicleId,
        kind: 'tyre_set',
        label: 'Michelin Primacy 4',
        brand: 'Michelin',
        specification: '205/55 R16 91V',
        installedAt: new Date(now - 400 * 86_400_000),
        installedOdometerKm: odometerKm - 19_500,
        purchasePrice: toMinorUnits(612, 'USD'),
        currency: 'USD',
        rotationIntervalKm: 10_000,
        lastRotatedOdometerKm: odometerKm - 12_000,
      },
      {
        id: randomUUID(),
        vehicleId,
        kind: 'battery',
        label: 'Interstate MTZ-47',
        brand: 'Interstate',
        specification: '12V 60Ah 680CCA',
        installedAt: new Date(now - 1_180 * 86_400_000),
        installedOdometerKm: odometerKm - 48_000,
        purchasePrice: toMinorUnits(189, 'USD'),
        currency: 'USD',
        warrantyExpiresAt: new Date(now + 120 * 86_400_000),
      },
    ],
  });

  // ---- Documents ----------------------------------------------------------
  await prisma.document.createMany({
    data: [
      {
        id: randomUUID(),
        userId,
        vehicleId,
        type: 'insurance_policy',
        title: 'Comprehensive insurance',
        issuer: 'Northbridge Mutual',
        issuedAt: new Date(now - 320 * 86_400_000),
        // Inside the 30-day window, so the expiring-soon path is exercised.
        expiresAt: new Date(now + 22 * 86_400_000),
        reminderOffsetsDays: [60, 30, 14, 7, 1],
        reminderEnabled: true,
      },
      {
        id: randomUUID(),
        userId,
        vehicleId,
        type: 'vehicle_registration',
        title: 'Vehicle registration',
        issuer: 'State DMV',
        expiresAt: new Date(now + 190 * 86_400_000),
        reminderOffsetsDays: [60, 30, 14, 7, 1],
        reminderEnabled: true,
      },
      {
        id: randomUUID(),
        userId,
        type: 'drivers_licence',
        title: "Driver's licence",
        issuer: 'State DMV',
        // Already expired, so the overdue path renders too.
        expiresAt: new Date(now - 5 * 86_400_000),
        reminderOffsetsDays: [60, 30, 14, 7, 1],
        reminderEnabled: true,
      },
    ],
  });

  // ---- Other expenses -----------------------------------------------------
  await prisma.expense.createMany({
    data: [
      {
        id: randomUUID(),
        vehicleId,
        category: 'insurance',
        title: 'Insurance premium',
        amount: toMinorUnits(1_140, 'USD'),
        currency: 'USD',
        incurredAt: new Date(now - 320 * 86_400_000),
        source: 'manual',
      },
      {
        id: randomUUID(),
        vehicleId,
        category: 'registration',
        title: 'Annual registration',
        amount: toMinorUnits(165, 'USD'),
        currency: 'USD',
        incurredAt: new Date(now - 175 * 86_400_000),
        source: 'manual',
      },
      {
        id: randomUUID(),
        vehicleId,
        category: 'car_wash',
        title: 'Car wash',
        amount: toMinorUnits(24, 'USD'),
        currency: 'USD',
        incurredAt: new Date(now - 12 * 86_400_000),
        source: 'manual',
      },
      {
        id: randomUUID(),
        vehicleId,
        category: 'parking',
        title: 'Monthly parking',
        amount: toMinorUnits(180, 'USD'),
        currency: 'USD',
        incurredAt: new Date(now - 20 * 86_400_000),
        source: 'manual',
      },
    ],
  });

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
