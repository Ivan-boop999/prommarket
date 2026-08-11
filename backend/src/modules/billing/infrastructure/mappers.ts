import type { Prisma } from '../../../generated/prisma/client'
import type { DbClient } from '../../../db'

/**
 * Shared monetization infrastructure helpers.
 *
 * Invoice numbering, decimal/string conversion, and advisory locks live here so
 * every monetization module (subscriptions, leads, billing, broker) uses the
 * same atomic sequence and the same money convention.
 */

/**
 * Atomically allocate the next invoice number for a year.
 * Mirrors the DealNumberSequence pattern: `UPDATE ... SET next = next + 1 RETURNING next`
 * inside the caller's transaction. Returns the human-readable `INV-YYYY-NNNN` form.
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient | DbClient,
  year: number,
): Promise<string> {
  // Upsert the year row, then increment. Prisma's upsert cannot RETURNING the
  // post-increment value in one statement, so do it as a raw UPDATE ... RETURNING.
  await tx.invoiceNumberSequence.upsert({
    where: { year },
    create: { year, next: 1 },
    update: {},
  })
  const rows = await tx.$queryRaw<{ next: number }[]>`
    UPDATE invoice_number_sequence
       SET next = next + 1
     WHERE year = ${year}
    RETURNING next
  `
  const next = rows[0]?.next ?? 1
  return `INV-${year}-${String(next - 1).padStart(4, '0')}`
}

/** Decimal → wire string. Null stays null. */
export function decimalToString(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.toString()
}

/** Advisory lock keyed on a string tag, inside the current transaction. */
export function acquireTaggedXactLock(
  tx: Prisma.TransactionClient | DbClient,
  tag: string,
) {
  return tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${tag}, 0))`,
  )
}

/** Add `days` to a date, returning a new Date (does not mutate input). */
export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/** Add `months` to a date. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime())
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}
