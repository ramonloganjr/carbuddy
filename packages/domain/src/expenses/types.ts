import type { CurrencyCode, IsoDateTime, Kilometres, Money, UUID } from '../common/types.js';

export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'repair'
  | 'insurance'
  | 'registration'
  | 'parking'
  | 'toll'
  | 'car_wash'
  | 'accessories'
  | 'financing'
  | 'fine'
  | 'inspection'
  | 'tyres'
  | 'parts'
  | 'roadside_assistance'
  | 'depreciation'
  | 'other';

/**
 * Where a cost came from.
 *
 * Fuel and maintenance are first-class entities with their own screens, but
 * they are also money spent, so the expense view projects them in. The
 * `source` discriminator is what keeps a fill-up from being counted twice when
 * it appears both in the fuel log and in the ownership total.
 */
export type ExpenseSource = 'manual' | 'fuel_record' | 'maintenance_record';

export interface Expense {
  readonly id: UUID;
  readonly vehicleId: UUID;
  readonly category: ExpenseCategory;
  readonly title?: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly incurredAt: IsoDateTime;
  readonly odometerKm?: Kilometres;
  readonly vendor?: string;
  readonly notes?: string;
  readonly source: ExpenseSource;
  /** Id of the originating fuel/maintenance record, when projected. */
  readonly sourceId?: UUID;
  readonly attachmentIds?: readonly UUID[];
  /** Set for recurring costs such as insurance instalments. */
  readonly recurrenceId?: UUID;
}

export const EXPENSE_CATEGORY_LABEL: Readonly<Record<ExpenseCategory, string>> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  repair: 'Repairs',
  insurance: 'Insurance',
  registration: 'Registration',
  parking: 'Parking',
  toll: 'Tolls',
  car_wash: 'Car wash',
  accessories: 'Accessories',
  financing: 'Financing',
  fine: 'Fines',
  inspection: 'Inspection',
  tyres: 'Tyres',
  parts: 'Parts',
  roadside_assistance: 'Roadside assistance',
  depreciation: 'Depreciation',
  other: 'Other',
};

/**
 * Categories that recur predictably. Used to decide whether a month with no
 * insurance payment is genuinely cheaper or just between instalments — the
 * difference matters when the UI calls out "your most expensive month".
 */
export const RECURRING_CATEGORIES: readonly ExpenseCategory[] = [
  'insurance',
  'registration',
  'financing',
];
