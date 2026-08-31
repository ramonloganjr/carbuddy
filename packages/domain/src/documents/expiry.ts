import { daysBetween, type IsoDateTime } from '../common/types.js';
import type { DocumentEvaluation, DocumentStatus, VehicleDocument } from './types.js';
import { DEFAULT_REMINDER_OFFSETS } from './types.js';

/** A document is "expiring soon" once it enters this window. */
export const EXPIRING_SOON_DAYS = 30;

export function evaluateDocument(
  document: VehicleDocument,
  now: IsoDateTime | Date,
): DocumentEvaluation {
  const base = {
    documentId: document.id,
    title: document.title,
    type: document.type,
    expiresAt: document.expiresAt ?? null,
  };

  if (!document.expiresAt) {
    return {
      ...base,
      status: 'no_expiry' as DocumentStatus,
      daysRemaining: null,
      reason: 'No expiry date',
    };
  }

  const daysRemaining = daysBetween(now, document.expiresAt);

  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return {
      ...base,
      status: 'expired',
      daysRemaining,
      reason: days === 1 ? 'Expired yesterday' : `Expired ${days} days ago`,
    };
  }

  if (daysRemaining <= EXPIRING_SOON_DAYS) {
    return {
      ...base,
      status: 'expiring_soon',
      daysRemaining,
      reason:
        daysRemaining === 0
          ? 'Expires today'
          : daysRemaining === 1
            ? 'Expires tomorrow'
            : `Expires in ${daysRemaining} days`,
    };
  }

  return {
    ...base,
    status: 'valid',
    daysRemaining,
    reason: `Valid for ${Math.round(daysRemaining / 30.44)} more months`,
  };
}

const STATUS_ORDER: Readonly<Record<DocumentStatus, number>> = {
  expired: 3,
  expiring_soon: 2,
  valid: 1,
  no_expiry: 0,
};

export function evaluateDocuments(
  documents: readonly VehicleDocument[],
  now: IsoDateTime | Date,
): DocumentEvaluation[] {
  return documents
    .filter((d) => !d.archivedAt)
    .map((d) => evaluateDocument(d, now))
    .sort((a, b) => {
      const order = STATUS_ORDER[b.status] - STATUS_ORDER[a.status];
      if (order !== 0) return order;
      return (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity);
    });
}

export function reminderOffsetsFor(document: VehicleDocument): readonly number[] {
  return document.reminderOffsetsDays ?? DEFAULT_REMINDER_OFFSETS[document.type] ?? [30, 7];
}
