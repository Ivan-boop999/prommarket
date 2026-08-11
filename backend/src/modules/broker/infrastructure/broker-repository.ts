import type {
  BrokerFeeLedgerEntry,
  BrokerFeeStats,
  BrokerFeesQuery,
  Invoice,
  InvoiceLineItem,
} from '@web-app-demo/contracts'
import { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import { BrokerFailure } from '../domain/errors'
import type { BrokerRepository } from '../application/ports'
import { addDays, allocateInvoiceNumber } from '../../billing/infrastructure/mappers'

type FeeRow = {
  id: string
  dealId: string
  brokerId: string
  baseAmount: { toString(): string }
  feePercent: { toString(): string }
  feeAmount: { toString(): string }
  status: string
  invoiceId: string | null
  accruedAt: Date
  paidAt: Date | null
  notes: string | null
  createdAt: Date
}

function toFeeDto(row: FeeRow): BrokerFeeLedgerEntry {
  return {
    id: row.id,
    dealId: row.dealId,
    brokerId: row.brokerId,
    baseAmount: row.baseAmount.toString(),
    feePercent: row.feePercent.toString(),
    feeAmount: row.feeAmount.toString(),
    status: row.status as BrokerFeeLedgerEntry['status'],
    invoiceId: row.invoiceId,
    accruedAt: row.accruedAt.toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    notes: row.notes,
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
    items: (row.items as InvoiceLineItem[]) ?? [],
    createdAt: row.createdAt.toISOString(),
  }
}

export function createPrismaBrokerRepository(db: DbClient): BrokerRepository {
  return {
    async accrueFee({ dealId, brokerId, baseAmount, feePercent, now }) {
      // Idempotent: if a fee already exists for this deal, return it unchanged.
      const existing = await db.brokerFeeLedger.findFirst({ where: { dealId } })
      if (existing) return toFeeDto(existing as FeeRow)

      const feeAmount = (baseAmount * feePercent) / 100
      const row = await db.$transaction(async (tx) => {
        const fee = await tx.brokerFeeLedger.create({
          data: {
            dealId,
            brokerId,
            baseAmount: new Prisma.Decimal(baseAmount),
            feePercent: new Prisma.Decimal(feePercent),
            feeAmount: new Prisma.Decimal(feeAmount),
            status: 'accrued',
            accruedAt: now,
          },
        })
        // Denormalize onto the deal.
        await tx.deal.update({
          where: { id: dealId },
          data: { commission: new Prisma.Decimal(feeAmount) },
        })
        return fee
      })
      return toFeeDto(row as FeeRow)
    },

    async listFees({ brokerId, query }) {
      const where: Prisma.BrokerFeeLedgerWhereInput = { brokerId }
      if (query.status && query.status.length > 0) where.status = { in: query.status }
      const [rows, total] = await Promise.all([
        db.brokerFeeLedger.findMany({
          where,
          orderBy: { accruedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        db.brokerFeeLedger.count({ where }),
      ])
      return { items: rows.map((r) => toFeeDto(r as FeeRow)), total }
    },

    async stats(brokerId) {
      const rows = await db.brokerFeeLedger.findMany({
        where: { brokerId },
        select: { status: true, feeAmount: true },
      })
      let accrued = 0
      let invoiced = 0
      let paid = 0
      for (const r of rows) {
        const amount = Number((r.feeAmount as { toString(): string }).toString())
        if (r.status === 'accrued') accrued += amount
        if (r.status === 'invoiced') invoiced += amount
        if (r.status === 'paid') paid += amount
      }
      const dto: BrokerFeeStats = {
        accruedTotal: String(accrued),
        invoicedTotal: String(invoiced),
        paidTotal: String(paid),
        outstandingTotal: String(accrued + invoiced),
        count: rows.length,
      }
      return dto
    },

    async invoiceFee({ feeId, currency, now }) {
      const year = now.getUTCFullYear()
      const result = await db.$transaction(async (tx) => {
        const fee = await tx.brokerFeeLedger.findUnique({ where: { id: feeId } })
        if (!fee) throw new BrokerFailure('fee_not_found', `Fee ${feeId} not found`)
        if (fee.status === 'invoiced' || fee.status === 'paid') {
          throw new BrokerFailure('not_payable', `Fee is ${fee.status}`)
        }
        const number = await allocateInvoiceNumber(tx, year)
        const invoice = await tx.invoice.create({
          data: {
            number,
            type: 'broker_fee',
            payerType: 'broker',
            payerUserId: fee.brokerId,
            dealId: fee.dealId,
            amount: fee.feeAmount,
            currency,
            status: 'issued',
            issuedAt: now,
            dueDate: addDays(now, 14),
            items: [
              {
                description: `Комиссия брокера по сделке`,
                quantity: 1,
                unitPrice: fee.feeAmount.toString(),
                total: fee.feeAmount.toString(),
              },
            ],
          },
        })
        const updatedFee = await tx.brokerFeeLedger.update({
          where: { id: feeId },
          data: { status: 'invoiced', invoiceId: invoice.id },
        })
        return { fee: updatedFee, invoice }
      })
      return { fee: toFeeDto(result.fee as FeeRow), invoice: toInvoiceDto(result.invoice as InvoiceRow) }
    },

    async confirmFeePayment({ feeId, confirmerId, paymentReference, now }) {
      const result = await db.$transaction(async (tx) => {
        const fee = await tx.brokerFeeLedger.findUnique({ where: { id: feeId } })
        if (!fee) throw new BrokerFailure('fee_not_found', `Fee ${feeId} not found`)
        if (fee.status === 'paid') throw new BrokerFailure('already_confirmed', 'Fee already paid')
        if (fee.status !== 'invoiced' || !fee.invoiceId) {
          throw new BrokerFailure('not_payable', 'Fee must be invoiced before payment')
        }
        const updatedInvoice = await tx.invoice.update({
          where: { id: fee.invoiceId },
          data: {
            status: 'paid',
            paidAt: now,
            confirmedAt: now,
            confirmedBy: confirmerId,
            paymentReference: paymentReference ?? undefined,
          },
        })
        const updatedFee = await tx.brokerFeeLedger.update({
          where: { id: feeId },
          data: { status: 'paid', paidAt: now },
        })
        return { fee: updatedFee, invoice: updatedInvoice }
      })
      return { fee: toFeeDto(result.fee as FeeRow), invoice: toInvoiceDto(result.invoice as InvoiceRow) }
    },
  }
}
