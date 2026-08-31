import { Prisma } from '@prisma/client';

/**
 * Prisma `Decimal` <-> `number` conversion.
 *
 * Distances and volumes are stored as `Decimal` so PostgreSQL never rounds
 * them, but the domain layer works in plain numbers — it has to run identically
 * in the React Native bundle, where a Decimal library would be dead weight.
 * The conversion happens here, at the boundary, and nowhere else.
 *
 * Money is deliberately *not* handled here: it is an integer count of minor
 * units all the way down, precisely so it never meets a decimal type.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toOptionalNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value);
}
