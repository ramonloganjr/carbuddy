import type { IsoDateTime, UUID } from '../common/types.js';

export type DocumentType =
  | 'vehicle_registration'
  | 'drivers_licence'
  | 'insurance_policy'
  | 'inspection_certificate'
  | 'road_tax'
  | 'emissions_certificate'
  | 'warranty'
  | 'roadside_assistance'
  | 'service_invoice'
  | 'purchase_agreement'
  | 'financing_agreement'
  | 'receipt'
  | 'permit'
  | 'other';

export const DOCUMENT_TYPE_LABEL: Readonly<Record<DocumentType, string>> = {
  vehicle_registration: 'Vehicle registration',
  drivers_licence: "Driver's licence",
  insurance_policy: 'Insurance policy',
  inspection_certificate: 'Inspection certificate',
  road_tax: 'Road tax',
  emissions_certificate: 'Emissions certificate',
  warranty: 'Warranty',
  roadside_assistance: 'Roadside assistance',
  service_invoice: 'Service invoice',
  purchase_agreement: 'Purchase agreement',
  financing_agreement: 'Financing agreement',
  receipt: 'Receipt',
  permit: 'Permit',
  other: 'Document',
};

/**
 * Documents that belong to the driver rather than to a car. They still expire,
 * still need reminders, and must survive the user selling a vehicle — so their
 * `vehicleId` is optional and the vault shows them under every vehicle.
 */
export const DRIVER_DOCUMENT_TYPES: readonly DocumentType[] = ['drivers_licence'];

export interface VehicleDocument {
  readonly id: UUID;
  readonly userId: UUID;
  /** Absent for driver-level documents such as a licence. */
  readonly vehicleId?: UUID;
  readonly type: DocumentType;
  readonly title: string;
  /** Policy/certificate number. Masked in list views. */
  readonly documentNumber?: string;
  readonly issuer?: string;
  readonly issuedAt?: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
  readonly notes?: string;
  readonly attachmentIds?: readonly UUID[];
  /**
   * Days before expiry to notify. Defaults applied at creation so the user can
   * override per document — a licence renewal needs more warning than a car wash
   * voucher.
   */
  readonly reminderOffsetsDays?: readonly number[];
  readonly reminderEnabled: boolean;
  readonly archivedAt?: IsoDateTime;
}

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';

export interface DocumentEvaluation {
  readonly documentId: UUID;
  readonly title: string;
  readonly type: DocumentType;
  readonly status: DocumentStatus;
  readonly daysRemaining: number | null;
  readonly expiresAt: IsoDateTime | null;
  readonly reason: string;
}

/** Sensible default lead times, tuned to how long each renewal actually takes. */
export const DEFAULT_REMINDER_OFFSETS: Readonly<Record<DocumentType, readonly number[]>> = {
  vehicle_registration: [60, 30, 14, 7, 1],
  drivers_licence: [60, 30, 14, 7, 1],
  insurance_policy: [60, 30, 14, 7, 1],
  inspection_certificate: [30, 14, 7, 1],
  road_tax: [30, 14, 7, 1],
  emissions_certificate: [30, 14, 7, 1],
  warranty: [60, 30],
  roadside_assistance: [30, 7],
  service_invoice: [],
  purchase_agreement: [],
  financing_agreement: [30],
  receipt: [],
  permit: [30, 7, 1],
  other: [30, 7],
};
