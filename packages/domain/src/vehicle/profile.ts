import { daysBetween, type IsoDateTime, type Kilometres } from '../common/types.js';
import { maskIdentifier } from '../common/mask.js';
import type { PowertrainProfile } from '../maintenance/defaults.js';
import type { OdometerReading, Vehicle } from './types.js';

/**
 * The name shown everywhere in the UI.
 *
 * Falls back through nickname -> year make model -> make model -> plate, so a
 * vehicle always has *something* readable no matter how little was entered.
 */
export function vehicleDisplayName(vehicle: Vehicle): string {
  const nickname = vehicle.nickname?.trim();
  if (nickname) return nickname;

  const parts = [vehicle.modelYear, vehicle.make, vehicle.model].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');

  return vehicle.plateNumber ?? 'My vehicle';
}

/** Secondary line under the name: `2019 · Toyota Corolla · 1.8 Hybrid`. */
export function vehicleSubtitle(vehicle: Vehicle): string {
  return [
    vehicle.modelYear,
    [vehicle.make, vehicle.model].filter(Boolean).join(' '),
    vehicle.variant,
  ]
    .filter((part) => part !== undefined && part !== '' && part !== null)
    .join(' · ');
}

/** Identifiers as they should appear before the user taps to reveal them. */
export function maskedIdentifiers(vehicle: Vehicle): {
  vin: string;
  plate: string;
  engineNumber: string;
  registration: string;
} {
  return {
    vin: maskIdentifier(vehicle.vin, 'vin'),
    plate: maskIdentifier(vehicle.plateNumber, 'plate'),
    engineNumber: maskIdentifier(vehicle.engineNumber, 'engineNumber'),
    registration: maskIdentifier(vehicle.registrationNumber, 'registration'),
  };
}

/** Map the engine type onto the maintenance schedule family it belongs to. */
export function powertrainProfile(vehicle: Vehicle): PowertrainProfile {
  switch (vehicle.engineType) {
    case 'diesel':
      return 'diesel';
    case 'electric':
      return 'electric';
    case 'hybrid':
    case 'plugin_hybrid':
      return 'hybrid';
    default:
      return 'petrol';
  }
}

/** Total distance covered since purchase, when a purchase reading is known. */
export function distanceSincePurchase(vehicle: Vehicle): Kilometres | null {
  if (vehicle.purchaseOdometerKm === undefined) return null;
  return Math.max(0, vehicle.currentOdometerKm - vehicle.purchaseOdometerKm);
}

export function vehicleAgeMonths(vehicle: Vehicle, now: IsoDateTime | Date): number | null {
  if (!vehicle.purchasedAt) return null;
  return Math.max(0, Math.round(daysBetween(vehicle.purchasedAt, now) / 30.44));
}

export type OdometerValidation =
  | { valid: true; warning?: 'large_jump' }
  | { valid: false; reason: 'decreasing' | 'implausible_jump' | 'negative' };

/** Above this, a single jump is almost certainly a typo rather than a road trip. */
const IMPLAUSIBLE_JUMP_KM = 20_000;
const LARGE_JUMP_KM = 5_000;

/**
 * Sanity-check a new odometer reading against the last known one.
 *
 * A decreasing odometer is rejected outright, because every downstream
 * calculation — consumption, service intervals, cost per kilometre — assumes
 * monotonic distance, and one bad reading silently corrupts all of them. A
 * merely *large* jump is allowed but flagged, since long trips are real and the
 * app should not argue with someone who just drove across a country.
 */
export function validateOdometerReading(
  newReadingKm: Kilometres,
  lastKnownKm: Kilometres | null,
): OdometerValidation {
  if (!Number.isFinite(newReadingKm) || newReadingKm < 0) {
    return { valid: false, reason: 'negative' };
  }
  if (lastKnownKm === null) return { valid: true };
  if (newReadingKm < lastKnownKm) return { valid: false, reason: 'decreasing' };

  const jump = newReadingKm - lastKnownKm;
  if (jump > IMPLAUSIBLE_JUMP_KM) return { valid: false, reason: 'implausible_jump' };
  if (jump > LARGE_JUMP_KM) return { valid: true, warning: 'large_jump' };
  return { valid: true };
}

/**
 * Latest reading across every source that reports one. Fuel entries usually win
 * because people log those most often, but a manual check-in taken later should
 * still take precedence — so this compares recorded time, not source type.
 */
export function latestOdometer(readings: readonly OdometerReading[]): OdometerReading | null {
  if (readings.length === 0) return null;
  return [...readings].sort((a, b) => {
    const time = new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
    if (time !== 0) return time;
    return b.odometerKm - a.odometerKm;
  })[0] as OdometerReading;
}

/**
 * Estimate today's odometer from the last reading plus typical daily driving.
 *
 * Used for "your service is probably due about now" prompts when the user has
 * not opened the app in weeks. Always presented as an estimate in the UI, and
 * never written back as a real reading.
 */
export function projectedOdometer(
  lastReading: OdometerReading | null,
  averageDailyDistanceKm: number | null,
  now: IsoDateTime | Date,
): { odometerKm: Kilometres; isEstimate: boolean } | null {
  if (!lastReading) return null;
  if (averageDailyDistanceKm === null || averageDailyDistanceKm <= 0) {
    return { odometerKm: lastReading.odometerKm, isEstimate: false };
  }
  const days = Math.max(0, daysBetween(lastReading.recordedAt, now));
  if (days === 0) return { odometerKm: lastReading.odometerKm, isEstimate: false };
  return {
    odometerKm: Math.round(lastReading.odometerKm + days * averageDailyDistanceKm),
    isEstimate: true,
  };
}
