import type { Kilometres } from '../common/types.js';
import type { MaintenanceCategory } from './types.js';

export const MAINTENANCE_CATEGORY_LABEL: Readonly<Record<MaintenanceCategory, string>> = {
  engine_oil: 'Engine oil',
  oil_filter: 'Oil filter',
  air_filter: 'Air filter',
  cabin_filter: 'Cabin filter',
  fuel_filter: 'Fuel filter',
  transmission_fluid: 'Transmission fluid',
  coolant: 'Coolant',
  brake_fluid: 'Brake fluid',
  power_steering_fluid: 'Power steering fluid',
  brake_pads: 'Brake pads',
  brake_discs: 'Brake discs',
  battery: 'Battery',
  spark_plugs: 'Spark plugs',
  ignition_coils: 'Ignition coils',
  timing_belt: 'Timing belt',
  serpentine_belt: 'Drive belt',
  tyres: 'Tyres',
  tyre_rotation: 'Tyre rotation',
  wheel_alignment: 'Wheel alignment',
  wheel_balancing: 'Wheel balancing',
  suspension: 'Suspension',
  shock_absorbers: 'Shock absorbers',
  clutch: 'Clutch',
  exhaust: 'Exhaust',
  air_conditioning: 'Air conditioning',
  wiper_blades: 'Wiper blades',
  lights: 'Lights',
  inspection: 'Inspection',
  general_service: 'General service',
  repair: 'Repair',
  bodywork: 'Bodywork',
  detailing: 'Detailing',
  custom: 'Other',
};

export interface ScheduleTemplate {
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly intervalMonths?: number;
  readonly intervalDistanceKm?: Kilometres;
}

/**
 * Starter service schedule offered when a vehicle is added.
 *
 * These are common-practice intervals, not manufacturer specifications for any
 * particular car — the onboarding copy says exactly that and points the user at
 * their owner's manual. They exist so the product is useful before the user has
 * typed anything, which matters far more than being precise for every model.
 *
 * Diesel and electric variants differ enough that they get their own sets
 * rather than a petrol list with items awkwardly filtered out.
 */
const PETROL_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    category: 'engine_oil',
    title: 'Engine oil & filter',
    intervalMonths: 6,
    intervalDistanceKm: 10_000,
  },
  { category: 'air_filter', title: 'Air filter', intervalMonths: 12, intervalDistanceKm: 20_000 },
  {
    category: 'cabin_filter',
    title: 'Cabin filter',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
  {
    category: 'tyre_rotation',
    title: 'Tyre rotation',
    intervalMonths: 6,
    intervalDistanceKm: 10_000,
  },
  { category: 'brake_fluid', title: 'Brake fluid', intervalMonths: 24 },
  { category: 'spark_plugs', title: 'Spark plugs', intervalDistanceKm: 60_000 },
  { category: 'coolant', title: 'Coolant', intervalMonths: 48, intervalDistanceKm: 80_000 },
  { category: 'transmission_fluid', title: 'Transmission fluid', intervalDistanceKm: 60_000 },
  {
    category: 'wheel_alignment',
    title: 'Wheel alignment',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
  { category: 'inspection', title: 'Safety inspection', intervalMonths: 12 },
  {
    category: 'general_service',
    title: 'General service',
    intervalMonths: 12,
    intervalDistanceKm: 15_000,
  },
];

const DIESEL_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    category: 'engine_oil',
    title: 'Engine oil & filter',
    intervalMonths: 12,
    intervalDistanceKm: 15_000,
  },
  { category: 'fuel_filter', title: 'Fuel filter', intervalMonths: 24, intervalDistanceKm: 40_000 },
  { category: 'air_filter', title: 'Air filter', intervalMonths: 12, intervalDistanceKm: 20_000 },
  {
    category: 'cabin_filter',
    title: 'Cabin filter',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
  {
    category: 'tyre_rotation',
    title: 'Tyre rotation',
    intervalMonths: 6,
    intervalDistanceKm: 10_000,
  },
  { category: 'brake_fluid', title: 'Brake fluid', intervalMonths: 24 },
  { category: 'coolant', title: 'Coolant', intervalMonths: 48, intervalDistanceKm: 80_000 },
  {
    category: 'timing_belt',
    title: 'Timing belt',
    intervalMonths: 84,
    intervalDistanceKm: 120_000,
  },
  { category: 'inspection', title: 'Safety inspection', intervalMonths: 12 },
  {
    category: 'general_service',
    title: 'General service',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
];

const ELECTRIC_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    category: 'tyre_rotation',
    title: 'Tyre rotation',
    intervalMonths: 6,
    intervalDistanceKm: 10_000,
  },
  { category: 'brake_fluid', title: 'Brake fluid', intervalMonths: 24 },
  {
    category: 'cabin_filter',
    title: 'Cabin filter',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
  { category: 'coolant', title: 'Battery coolant', intervalMonths: 48 },
  {
    category: 'wheel_alignment',
    title: 'Wheel alignment',
    intervalMonths: 12,
    intervalDistanceKm: 20_000,
  },
  { category: 'inspection', title: 'Safety inspection', intervalMonths: 12 },
  { category: 'general_service', title: 'General service', intervalMonths: 24 },
];

export type PowertrainProfile = 'petrol' | 'diesel' | 'electric' | 'hybrid';

export function starterSchedules(profile: PowertrainProfile): readonly ScheduleTemplate[] {
  switch (profile) {
    case 'diesel':
      return DIESEL_TEMPLATES;
    case 'electric':
      return ELECTRIC_TEMPLATES;
    // A hybrid still has a combustion engine; its oil ages faster than it wears
    // because the engine spends so much time off, so the interval stays modest.
    case 'hybrid':
    case 'petrol':
    default:
      return PETROL_TEMPLATES;
  }
}
