import type {
  Invoice,
  InvoiceLineItem,
  SubscriptionPlan,
  VendorSubscription,
} from '@web-app-demo/contracts'

import type { DbClient } from '../../../db'
import { SubscriptionFailure } from '../domain/errors'
import type { SubscriptionRepository } from '../application/ports'
import { addMonths, allocateInvoiceNumber, decimalToString } from '../../billing/infrastructure/mappers'

// ---------------------------------------------------------------------------
// DTO mappers (Prisma row → contract). These keep the wire shape exact and
// centralize the Decimal→string conversion so money never crosses as a float.
// ---------------------------------------------------------------------------

type PlanRow = {
  id: string
  code: string
  name: string
  description: string | null
  price: { toString(): string }
  currency: string
  billingPeriod: string
  maxProducts: number | null
  maxRegions: number | null
  includedLeadCredits: number
  hasFeatured: boolean
  hasPrioritySupport: boolean
  isActive: boolean
  sortOrder: number
}

function toPlanDto(row: PlanRow): SubscriptionPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: row.price.toString(),
    currency: row.currency,
    billingPeriod: row.billingPeriod as SubscriptionPlan['billingPeriod'],
    maxProducts: row.maxProducts,
    maxRegions: row.maxRegions,
    includedLeadCredits: row.includedLeadCredits,
    hasFeatured: row.hasFeatured,
    hasPrioritySupport: row.hasPrioritySupport,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

function billingPeriodMonths(period: SubscriptionPlan['billingPeriod']): number {
  switch (period) {
    case 'monthly':
      return 1
    case 'quarterly':
      return 3
    case 'yearly':
      return 12
  }
}

type SubscriptionRow = {
  id: string
  vendorId: string
  planId: string
  status: string
  periodStart: Date
  periodEnd: Date | null
  amount: { toString(): string }
  currency: string
  invoiceId: string | null
  confirmedAt: Date | null
  createdAt: Date
  plan: PlanRow | null
}

function toSubscriptionDto(row: SubscriptionRow): VendorSubscription {
  return {
    id: row.id,
    vendorId: row.vendorId,
    planId: row.planId,
    status: row.status as VendorSubscription['status'],
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd ? row.periodEnd.toISOString() : null,
    amount: row.amount.toString(),
    currency: row.currency,
    invoiceId: row.invoiceId,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    plan: row.plan ? toPlanDto(row.plan) : undefined,
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

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export function createPrismaSubscriptionsRepository(db: DbClient): SubscriptionRepository {
  return {
    async listActivePlans() {
      const rows = await db.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      })
      return rows.map(toPlanDto)
    },

    async findPlanById(id) {
      const row = await db.subscriptionPlan.findUnique({ where: { id } })
      return row ? toPlanDto(row) : null
    },

    async findActiveSubscriptionByVendor(vendorId) {
      const row = await db.vendorSubscription.findFirst({
        where: {
          vendorId,
          status: { in: ['pending_payment', 'active', 'past_due'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      })
      return row ? toSubscriptionDto(row as unknown as SubscriptionRow) : null
    },

    async findPendingSubscription(vendorId, planId) {
      const row = await db.vendorSubscription.findFirst({
        where: { vendorId, planId, status: 'pending_payment' },
      })
      return row ? toSubscriptionDto(row as unknown as unknown as SubscriptionRow) : null
    },

    async findVendorByUserId(userId) {
      const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
      return vendor ?? null
    },

    async createPendingSubscription({ vendorId, plan, periodStart }) {
      const periodEnd = addMonths(periodStart, billingPeriodMonths(plan.billingPeriod))
      const dueInDays = 5
      const dueDate = new Date(periodStart.getTime())
      dueDate.setUTCDate(dueDate.getUTCDate() + dueInDays)
      const year = periodStart.getUTCFullYear()

      // One transaction: allocate invoice number, create invoice (issued) +
      // pending subscription that references it.
      const result = await db.$transaction(async (tx) => {
        const number = await allocateInvoiceNumber(tx, year)
        const invoice = await tx.invoice.create({
          data: {
            number,
            type: 'subscription',
            payerType: 'vendor',
            payerUserId: vendorId,
            vendorId,
            amount: plan.price,
            currency: plan.currency,
            status: 'issued',
            issuedAt: periodStart,
            dueDate,
            items: [
              {
                description: `Подписка «${plan.name}» (${plan.billingPeriod})`,
                quantity: 1,
                unitPrice: plan.price,
                total: plan.price,
              },
            ],
          },
        })
        const subscription = await tx.vendorSubscription.create({
          data: {
            vendorId,
            planId: plan.id,
            status: 'pending_payment',
            periodStart,
            periodEnd,
            amount: plan.price,
            currency: plan.currency,
            invoiceId: invoice.id,
          },
        })
        return { subscription, invoice }
      })

      // Re-fetch with plan included for the DTO.
      const sub = await db.vendorSubscription.findUnique({
        where: { id: result.subscription.id },
        include: { plan: true },
      })
      const inv = await db.invoice.findUnique({ where: { id: result.invoice.id } })
      if (!sub || !inv) {
        throw new SubscriptionFailure('not_found', 'Subscription or invoice vanished after create')
      }
      return {
        subscription: toSubscriptionDto(sub as unknown as SubscriptionRow),
        invoice: toInvoiceDto(inv as InvoiceRow),
      }
    },

    async confirmInvoicePayment({ invoiceId, confirmerId, paymentReference, now }) {
      const result = await db.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) {
          throw new SubscriptionFailure('invoice_not_found', `Invoice ${invoiceId} not found`)
        }
        if (invoice.type !== 'subscription') {
          throw new SubscriptionFailure('not_payable', `Invoice ${invoiceId} is not a subscription invoice`)
        }
        if (invoice.status === 'paid') {
          throw new SubscriptionFailure('already_confirmed', `Invoice ${invoiceId} already confirmed`)
        }
        if (invoice.status !== 'issued' && invoice.status !== 'overdue') {
          throw new SubscriptionFailure('not_payable', `Invoice ${invoiceId} is ${invoice.status}, not payable`)
        }

        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'paid',
            paidAt: now,
            confirmedAt: now,
            confirmedBy: confirmerId,
            paymentReference: paymentReference ?? invoice.paymentReference,
          },
        })

        // Activate the subscription tied to this invoice and compute periodEnd.
        const subscription = await tx.vendorSubscription.findFirst({
          where: { invoiceId },
          include: { plan: true },
        })
        if (!subscription) {
          throw new SubscriptionFailure('not_found', `No subscription for invoice ${invoiceId}`)
        }
        const months = billingPeriodMonths(
          (subscription.plan as PlanRow).billingPeriod as SubscriptionPlan['billingPeriod'],
        )
        const periodEnd = addMonths(now, months)
        const updated = await tx.vendorSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            periodStart: now,
            periodEnd,
            confirmedAt: now,
            confirmedBy: confirmerId,
          },
          include: { plan: true },
        })

        // Grant any lead credits included in the plan.
        const includedCredits = (subscription.plan as PlanRow).includedLeadCredits
        if (includedCredits > 0) {
          const balanceRows = await tx.leadCreditLedger.aggregate({
            where: { vendorId: subscription.vendorId },
            _sum: { delta: true },
          })
          const balanceAfter = (balanceRows._sum.delta ?? 0) + includedCredits
          await tx.leadCreditLedger.create({
            data: {
              vendorId: subscription.vendorId,
              delta: includedCredits,
              reason: 'subscription_grant',
              referenceId: invoiceId,
              balanceAfter,
            },
          })
        }

        return { invoice: updatedInvoice, subscription: updated }
      })

      return {
        invoice: toInvoiceDto(result.invoice as InvoiceRow),
        subscription: toSubscriptionDto(result.subscription as unknown as SubscriptionRow),
      }
    },

    async listVendorInvoices(vendorId) {
      const rows = await db.invoice.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map((r) => toInvoiceDto(r as InvoiceRow))
    },
  }
}

// Re-export for callers that need the money helper.
export { decimalToString }
