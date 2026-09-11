import type {
  Invoice,
  LeadCreditBalance,
  LeadCreditLedgerEntry,
} from '@prommarket/contracts'
import { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import { LeadFailure } from '../domain/errors'
import type { LeadRepository } from '../application/ports'
import { acquireTaggedXactLock, allocateInvoiceNumber } from '../../billing'

type LedgerRow = {
  id: string
  vendorId: string
  delta: number
  reason: string
  referenceId: string | null
  balanceAfter: number
  createdAt: Date
}

function toLedgerDto(row: LedgerRow): LeadCreditLedgerEntry {
  return {
    id: row.id,
    vendorId: row.vendorId,
    delta: row.delta,
    reason: row.reason as LeadCreditLedgerEntry['reason'],
    referenceId: row.referenceId,
    balanceAfter: row.balanceAfter,
    createdAt: row.createdAt.toISOString(),
  }
}

type InvoiceRow = {
  id: string
  number: string
  type: string
  payerType: string
  payerUserId: string
  vendorId: string | null
  subscriptionId: string | null
  dealId: string | null
  amount: { toString(): string }
  currency: string
  status: string
  dueDate: Date | null
  issuedAt: Date | null
  paidAt: Date | null
  paymentReference: string | null
  confirmedAt: Date | null
  notes: string | null
  items: unknown
  createdAt: Date
}

function toInvoiceDto(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    type: row.type as Invoice['type'],
    payerType: row.payerType as Invoice['payerType'],
    payerUserId: row.payerUserId,
    vendorId: row.vendorId,
    subscriptionId: row.subscriptionId,
    dealId: row.dealId,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status as Invoice['status'],
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paymentReference: row.paymentReference,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    notes: row.notes,
    items: (row.items as Invoice['items']) ?? [],
    createdAt: row.createdAt.toISOString(),
  }
}

export function createPrismaLeadsRepository(db: DbClient): LeadRepository {
  return {
    async balance(vendorId) {
      const agg = await db.leadCreditLedger.aggregate({
        where: { vendorId },
        _sum: { delta: true },
      })
      const balance = agg._sum.delta ?? 0
      const dto: LeadCreditBalance = { vendorId, balance }
      return dto
    },

    async ledger(vendorId) {
      const rows = await db.leadCreditLedger.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      return rows.map((r) => toLedgerDto(r as LedgerRow))
    },

    async unlockLead({ vendorId, referenceId, cost }) {
      const result = await db.$transaction(async (tx) => {
        // Serialize credit mutations for this vendor.
        await acquireTaggedXactLock(tx, `lead-credits:${vendorId}`)

        // Idempotency: if this RFQ was already unlocked by this vendor, do not charge again.
        const existing = await tx.leadCreditLedger.findFirst({
          where: { vendorId, referenceId, reason: 'rfq_unlock' },
        })
        if (existing) {
          throw new LeadFailure('already_unlocked', 'This lead is already unlocked')
        }

        const agg = await tx.leadCreditLedger.aggregate({
          where: { vendorId },
          _sum: { delta: true },
        })
        const current = agg._sum.delta ?? 0
        if (current < cost) {
          throw new LeadFailure(
            'insufficient_credits',
            `Need ${cost} credits, have ${current}`,
          )
        }
        const balanceAfter = current - cost
        const entry = await tx.leadCreditLedger.create({
          data: {
            vendorId,
            delta: -cost,
            reason: 'rfq_unlock',
            referenceId,
            balanceAfter,
          },
        })
        return { ledgerEntry: entry, balance: balanceAfter }
      })
      return {
        ledgerEntry: toLedgerDto(result.ledgerEntry as LedgerRow),
        balance: result.balance,
      }
    },

    async createPurchaseInvoice({ vendorId, credits, unitPrice, currency }) {
      const now = new Date()
      const year = now.getUTCFullYear()
      const total = unitPrice * credits
      const dueDate = new Date(now.getTime())
      dueDate.setUTCDate(dueDate.getUTCDate() + 5)

      const invoice = await db.$transaction(async (tx) => {
        const number = await allocateInvoiceNumber(tx, year)
        const unitPriceDecimal = new Prisma.Decimal(unitPrice)
        const totalDecimal = new Prisma.Decimal(total)
        return tx.invoice.create({
          data: {
            number,
            type: 'lead_credits',
            payerType: 'vendor',
            payerUserId: vendorId,
            vendorId,
            amount: totalDecimal,
            currency,
            status: 'issued',
            issuedAt: now,
            dueDate,
            items: [
              {
                description: `Покупка ${credits} лид-кредитов`,
                quantity: credits,
                unitPrice: unitPriceDecimal.toString(),
                total: totalDecimal.toString(),
              },
            ],
          },
        })
      })
      return { invoice: toInvoiceDto(invoice as InvoiceRow) }
    },

    async confirmPurchase({ invoiceId, confirmerId, paymentReference, now }) {
      const balance = await db.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) {
          throw new LeadFailure('invoice_not_found', `Invoice ${invoiceId} not found`)
        }
        if (invoice.type !== 'lead_credits') {
          throw new LeadFailure('not_payable', `Invoice ${invoiceId} is not a lead-credit invoice`)
        }
        if (invoice.status === 'paid') {
          throw new LeadFailure('already_confirmed', `Invoice ${invoiceId} already confirmed`)
        }
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'paid',
            paidAt: now,
            confirmedAt: now,
            confirmedBy: confirmerId,
            paymentReference: paymentReference ?? invoice.paymentReference,
          },
        })
        // Grant the credits: sum the unitPrice × quantity from the line items.
        const items = (invoice.items ?? []) as Array<{ quantity?: number }>
        const credits = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)
        const vendorId = invoice.vendorId
        if (!vendorId || credits <= 0) {
          throw new LeadFailure('not_payable', 'Invoice has no vendor or credits')
        }
        await acquireTaggedXactLock(tx, `lead-credits:${vendorId}`)
        const agg = await tx.leadCreditLedger.aggregate({
          where: { vendorId },
          _sum: { delta: true },
        })
        const current = agg._sum.delta ?? 0
        const balanceAfter = current + credits
        await tx.leadCreditLedger.create({
          data: {
            vendorId,
            delta: credits,
            reason: 'purchase',
            referenceId: invoiceId,
            balanceAfter,
          },
        })
        return balanceAfter
      })
      const inv = await db.invoice.findUnique({ where: { id: invoiceId } })
      return { invoice: toInvoiceDto(inv as InvoiceRow), balance }
    },
  }
}
