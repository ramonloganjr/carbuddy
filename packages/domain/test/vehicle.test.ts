import { beforeEach, describe, expect, it } from 'vitest';
import {
  distanceSincePurchase,
  latestOdometer,
  maskedIdentifiers,
  powertrainProfile,
  projectedOdometer,
  validateOdometerReading,
  vehicleDisplayName,
  vehicleSubtitle,
} from '../src/vehicle/profile.js';
import { formatVin, maskIdentifier, validateVin } from '../src/common/mask.js';
import { evaluateDocument, evaluateDocuments } from '../src/documents/expiry.js';
import { document, resetIds, vehicle } from './factories.js';

beforeEach(resetIds);

const NOW = '2025-03-01T00:00:00.000Z';

describe('vehicle naming', () => {
  it('prefers the nickname', () => {
    expect(vehicleDisplayName(vehicle({ nickname: 'The Beast' }))).toBe('The Beast');
  });

  it('falls back through year/make/model then plate', () => {
    expect(vehicleDisplayName(vehicle({ nickname: '  ' }))).toBe('2019 Toyota Corolla');
    expect(
      vehicleDisplayName(
        vehicle({
          nickname: '',
          make: '',
          model: '',
          modelYear: undefined,
          plateNumber: 'ABC 123',
        }),
      ),
    ).toBe('ABC 123');
  });

  it('always produces something readable', () => {
    expect(
      vehicleDisplayName(vehicle({ nickname: '', make: '', model: '', modelYear: undefined })),
    ).toBe('My vehicle');
  });

  it('builds a subtitle without stray separators', () => {
    expect(vehicleSubtitle(vehicle({ variant: '1.8 Hybrid' }))).toBe(
      '2019 · Toyota Corolla · 1.8 Hybrid',
    );
    expect(vehicleSubtitle(vehicle({ variant: undefined }))).toBe('2019 · Toyota Corolla');
  });
});

describe('identifier masking', () => {
  it('reveals only the tail of a VIN', () => {
    const masked = maskIdentifier('WVWZZZ1JZXW000123', 'vin');
    expect(masked.endsWith('000123')).toBe(true);
    expect(masked.startsWith('•')).toBe(true);
    expect(masked).toHaveLength(17);
  });

  it('preserves punctuation so the shape stays recognisable', () => {
    expect(maskIdentifier('ABC-1234', 'plate')).toBe('•••-•234');
  });

  it('leaves very short values alone rather than masking them to nothing', () => {
    expect(maskIdentifier('AB', 'plate')).toBe('AB');
  });

  it('handles missing values', () => {
    expect(maskIdentifier(undefined)).toBe('');
    expect(maskIdentifier(null)).toBe('');
  });

  it('masks every sensitive field on a vehicle', () => {
    const masked = maskedIdentifiers(
      vehicle({
        vin: 'WVWZZZ1JZXW000123',
        plateNumber: 'ABC 1234',
        engineNumber: 'ENG998877',
        registrationNumber: 'REG5544',
      }),
    );
    expect(masked.vin).toContain('•');
    expect(masked.plate).toContain('•');
    expect(masked.engineNumber).toContain('•');
    expect(masked.registration).toContain('•');
  });
});

describe('VIN validation', () => {
  it('accepts a VIN with a correct check digit', () => {
    // Widely used reference VIN with a valid ISO-3779 checksum.
    expect(validateVin('11111111111111111')).toEqual({ valid: true });
  });

  it('rejects the wrong length', () => {
    expect(validateVin('ABC123')).toEqual({ valid: false, reason: 'length' });
  });

  it('rejects letters excluded from the VIN alphabet', () => {
    expect(validateVin('IOQ1111111111111I')).toEqual({ valid: false, reason: 'characters' });
  });

  it('detects a transcription error via the check digit', () => {
    expect(validateVin('11111111211111111')).toEqual({ valid: false, reason: 'checksum' });
  });

  it('formats a VIN into readable groups', () => {
    expect(formatVin('WVWZZZ1JZXW000123')).toBe('WVW ZZZ 1JZ XW000123');
  });
});

describe('odometer validation', () => {
  it('accepts the first ever reading', () => {
    expect(validateOdometerReading(50_000, null)).toEqual({ valid: true });
  });

  /** Every downstream calculation assumes distance only goes up. */
  it('rejects a decreasing reading', () => {
    expect(validateOdometerReading(9_000, 10_000)).toEqual({ valid: false, reason: 'decreasing' });
  });

  it('rejects a jump too large to be real', () => {
    expect(validateOdometerReading(60_000, 10_000)).toEqual({
      valid: false,
      reason: 'implausible_jump',
    });
  });

  it('allows a long trip but flags it for confirmation', () => {
    expect(validateOdometerReading(18_000, 10_000)).toEqual({ valid: true, warning: 'large_jump' });
  });

  it('rejects negative and non-finite values', () => {
    expect(validateOdometerReading(-1, null)).toEqual({ valid: false, reason: 'negative' });
    expect(validateOdometerReading(Number.NaN, null)).toEqual({ valid: false, reason: 'negative' });
  });
});

describe('odometer projection', () => {
  const reading = {
    id: 'r1',
    vehicleId: 'vehicle-1',
    odometerKm: 10_000,
    recordedAt: '2025-02-01T00:00:00.000Z',
    source: 'manual' as const,
  };

  it('picks the most recent reading regardless of source', () => {
    const latest = latestOdometer([
      reading,
      {
        ...reading,
        id: 'r2',
        odometerKm: 10_500,
        recordedAt: '2025-02-20T00:00:00.000Z',
        source: 'fuel_record',
      },
    ]);
    expect(latest?.id).toBe('r2');
  });

  it('returns null with no readings', () => {
    expect(latestOdometer([])).toBeNull();
  });

  it('estimates today from typical daily driving and says it is an estimate', () => {
    const projected = projectedOdometer(reading, 40, NOW);
    expect(projected?.odometerKm).toBe(11_120); // 28 days at 40 km
    expect(projected?.isEstimate).toBe(true);
  });

  it('does not guess when driving habits are unknown', () => {
    const projected = projectedOdometer(reading, null, NOW);
    expect(projected?.odometerKm).toBe(10_000);
    expect(projected?.isEstimate).toBe(false);
  });
});

describe('vehicle profile helpers', () => {
  it('maps engine types onto maintenance families', () => {
    expect(powertrainProfile(vehicle({ engineType: 'diesel' }))).toBe('diesel');
    expect(powertrainProfile(vehicle({ engineType: 'plugin_hybrid' }))).toBe('hybrid');
    expect(powertrainProfile(vehicle({ engineType: 'electric' }))).toBe('electric');
    expect(powertrainProfile(vehicle({ engineType: undefined }))).toBe('petrol');
  });

  it('computes distance since purchase when known', () => {
    expect(
      distanceSincePurchase(vehicle({ purchaseOdometerKm: 5_000, currentOdometerKm: 12_000 })),
    ).toBe(7_000);
    expect(distanceSincePurchase(vehicle({ purchaseOdometerKm: undefined }))).toBeNull();
  });
});

describe('document expiry', () => {
  it('reports a document with no expiry date as such', () => {
    const result = evaluateDocument(document({ expiresAt: undefined }), NOW);
    expect(result.status).toBe('no_expiry');
    expect(result.daysRemaining).toBeNull();
  });

  it('classifies valid, expiring and expired documents', () => {
    expect(evaluateDocument(document({ expiresAt: '2026-01-01T00:00:00.000Z' }), NOW).status).toBe(
      'valid',
    );
    expect(evaluateDocument(document({ expiresAt: '2025-03-15T00:00:00.000Z' }), NOW).status).toBe(
      'expiring_soon',
    );
    expect(evaluateDocument(document({ expiresAt: '2025-02-01T00:00:00.000Z' }), NOW).status).toBe(
      'expired',
    );
  });

  it('uses natural language near the boundary', () => {
    expect(evaluateDocument(document({ expiresAt: '2025-03-01T00:00:00.000Z' }), NOW).reason).toBe(
      'Expires today',
    );
    expect(evaluateDocument(document({ expiresAt: '2025-03-02T00:00:00.000Z' }), NOW).reason).toBe(
      'Expires tomorrow',
    );
    expect(evaluateDocument(document({ expiresAt: '2025-02-28T00:00:00.000Z' }), NOW).reason).toBe(
      'Expired yesterday',
    );
  });

  it('sorts the most urgent documents first and hides archived ones', () => {
    const results = evaluateDocuments(
      [
        document({ id: 'valid', expiresAt: '2026-01-01T00:00:00.000Z' }),
        document({ id: 'expired', expiresAt: '2025-01-01T00:00:00.000Z' }),
        document({ id: 'soon', expiresAt: '2025-03-10T00:00:00.000Z' }),
        document({ id: 'archived', expiresAt: '2025-01-01T00:00:00.000Z', archivedAt: NOW }),
      ],
      NOW,
    );

    expect(results.map((r) => r.documentId)).toEqual(['expired', 'soon', 'valid']);
  });
});
