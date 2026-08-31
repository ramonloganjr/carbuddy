import { daysBetween, MS_PER_DAY, type Kilometres } from '../common/types.js';
import { makeEfficiency } from '../units/units.js';
import type {
  ConsumptionAnalysis,
  ConsumptionSegment,
  FuelRecord,
  UnmeasuredRecord,
} from './types.js';

/**
 * Chronological order for fuel records.
 *
 * Odometer is the primary key rather than the timestamp: users routinely
 * back-date a receipt they found in the glovebox, and the odometer is the one
 * value that is monotonic by physical necessity. Date breaks ties for two fills
 * at the same reading (a splash-and-dash at the same pump).
 */
export function sortFuelRecords(records: readonly FuelRecord[]): FuelRecord[] {
  return [...records].sort((a, b) => {
    if (a.odometerKm !== b.odometerKm) return a.odometerKm - b.odometerKm;
    return new Date(a.filledAt).getTime() - new Date(b.filledAt).getTime();
  });
}

/**
 * Turn a vehicle's fuel log into measured consumption segments.
 *
 * The method is "full-to-full": the fuel that appears on the receipt at the end
 * of a segment is the fuel consumed *over* that segment, because the tank was
 * full at both ends. Consequences that the implementation must respect:
 *
 *   - The opening record's own volume belongs to the previous segment, never
 *     this one. Counting it is the single most common way this calculation is
 *     gotten wrong, and it inflates consumption by roughly one tank.
 *   - Partial fills are not segment boundaries, but their volume still counts
 *     toward the next full tank's segment.
 *   - Anything before the first full tank is unmeasurable — the starting tank
 *     level is unknown.
 *   - A user-flagged missed fill invalidates the segment in progress and
 *     re-anchors, rather than silently producing an impossible figure.
 *
 * Pure and deterministic: same records in, same segments out, no clock access.
 */
export function analyseConsumption(records: readonly FuelRecord[]): ConsumptionAnalysis {
  const sorted = sortFuelRecords(records);
  const segments: ConsumptionSegment[] = [];
  const unmeasured: UnmeasuredRecord[] = [];

  /** Opening full tank of the segment currently being accumulated. */
  let anchor: FuelRecord | null = null;
  /** Fuel added since the anchor, excluding the anchor's own fill. */
  let pendingLitres = 0;
  let pendingCost = 0;
  let pendingFills = 0;
  /** Records folded into the current accumulation, for reporting if it aborts. */
  let pendingRecordIds: string[] = [];

  const abandonPending = (reason: UnmeasuredRecord['reason']) => {
    for (const recordId of pendingRecordIds) unmeasured.push({ recordId, reason });
    pendingLitres = 0;
    pendingCost = 0;
    pendingFills = 0;
    pendingRecordIds = [];
  };

  for (const record of sorted) {
    // A known-missing fill-up breaks the chain: whatever we accumulated is
    // short by an unknown amount of fuel, so it cannot become a segment.
    if (record.missedFill) {
      abandonPending('missed_fill_reset');
      anchor = record.isFullTank ? record : null;
      if (!record.isFullTank) {
        unmeasured.push({ recordId: record.id, reason: 'missed_fill_reset' });
      }
      continue;
    }

    if (anchor === null) {
      // Still waiting for the first full tank to establish a known start level.
      if (record.isFullTank) {
        anchor = record;
      } else {
        unmeasured.push({ recordId: record.id, reason: 'before_first_full_tank' });
      }
      continue;
    }

    pendingLitres += record.litres;
    pendingCost += record.totalCost;
    pendingFills += 1;
    pendingRecordIds.push(record.id);

    if (!record.isFullTank) {
      // Partial fill: volume is carried forward, but the tank level at this
      // point is unknown so it cannot close a segment.
      continue;
    }

    const distanceKm: Kilometres = record.odometerKm - anchor.odometerKm;

    if (distanceKm <= 0) {
      // Two full tanks at the same reading, or an odometer typo. Re-anchor at
      // the later record rather than emitting a divide-by-zero segment.
      abandonPending('no_distance');
      anchor = record;
      continue;
    }

    if (pendingLitres <= 0) {
      abandonPending('no_fuel');
      anchor = record;
      continue;
    }

    segments.push({
      fromRecordId: anchor.id,
      toRecordId: record.id,
      startedAt: anchor.filledAt,
      endedAt: record.filledAt,
      startOdometerKm: anchor.odometerKm,
      endOdometerKm: record.odometerKm,
      distanceKm,
      litres: pendingLitres,
      efficiency: makeEfficiency(distanceKm, pendingLitres),
      cost: pendingCost,
      currency: record.currency,
      days: Math.max(0, daysBetween(anchor.filledAt, record.filledAt)),
      fillCount: pendingFills,
    });

    anchor = record;
    pendingLitres = 0;
    pendingCost = 0;
    pendingFills = 0;
    pendingRecordIds = [];
  }

  // Anything still accumulating is simply waiting for the next full tank —
  // normal, not an error, and the UI says so rather than showing a gap.
  abandonPending('pending_next_full_tank');

  return { segments, unmeasured };
}

/**
 * Distance covered between the first and last logged odometer reading.
 * This is "distance we have receipts for", which is deliberately narrower than
 * the vehicle's lifetime mileage.
 */
export function loggedDistance(records: readonly FuelRecord[]): Kilometres {
  if (records.length < 2) return 0;
  const sorted = sortFuelRecords(records);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 0;
  return Math.max(0, last.odometerKm - first.odometerKm);
}

/**
 * Average distance driven per day, derived from the fuel log.
 *
 * This is the input that turns a mileage-based service interval into a
 * predicted *date* ("about 5 weeks away"), which is far more actionable to a
 * driver than "3,200 km away".
 *
 * Two details keep the estimate honest:
 *   - The span is measured in *fractional* days from the raw timestamps, not in
 *     rounded whole days, so a log spanning 9.5 days is not treated as 10.
 *   - Logs spanning less than a full day return null. Two fills three hours and
 *     150 km apart would otherwise imply 1,200 km/day and push every projected
 *     service date absurdly close.
 */
export function averageDailyDistance(records: readonly FuelRecord[]): number | null {
  const sorted = sortFuelRecords(records);
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  const distance = last.odometerKm - first.odometerKm;
  const spanMs = new Date(last.filledAt).getTime() - new Date(first.filledAt).getTime();
  const days = spanMs / MS_PER_DAY;
  if (distance <= 0 || days < 1) return null;
  return distance / days;
}

/** Price actually paid per litre on a record, in minor units. */
export function pricePerLitre(record: FuelRecord): number | null {
  if (record.litres <= 0) return null;
  return record.totalCost / record.litres;
}
