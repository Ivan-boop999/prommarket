import type {
  ActivateAddOnInput,
  CreateFeaturedPlacementInput,
  FeaturedPlacement,
  Invoice,
  InvoiceLineItem,
  VendorAddOn,
} from '@web-app-demo/contracts'
import { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import { BillingFailure } from '../domain/errors'
import type { BillingRepository } from '../application/ports'
import { acquireTaggedXactLock, addDays, allocateInvoiceNumber } from './mappers'

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

type PlacementRow = {
  id: string
  productId: string
  vendorId: string
  placement: string
  startAt: Date
  endAt: Date
  status: string
  invoiceId: string | null
  createdAt: Date
}

function toPlacementDto(row: PlacementRow): FeaturedPlacement {
  return {
    id: row.id,
    productId: row.productId,
    vendorId: row.vendorId,
    placement: row.placement as FeaturedPlacement['placement'],
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status as FeaturedPlacement['status'],
    invoiceId: row.invoiceId,
    createdAt: row.createdAt.toISOString(),
  }
}

type AddOnRow = {
  id: string
  vendorId: string
  feature: string
  status: string
  activatedAt: Date | null
  expiresAt: Date | null
  invoiceId: string | null
  createdAt: Date
}

function toAddOnDto(row: AddOnRow): VendorAddOn {
  return {
    id: row.id,
    vendorId: row.vendorId,
    feature: row.feature as VendorAddOn['feature'],
    status: row.status as VendorAddOn['status'],
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    invoiceId: row.invoiceId,
    createdAt: row.createdAt.toISOString(),
  }
}

function computeAmount(pricePerDay: number, days: number, currency: string) {
  const total = pricePerDay * days
  return { totalDecimal: new Prisma.Decimal(total), total }
}

export function createPrismaBillingRepository(db: DbClient): BillingRepository {
  return {
    async createFeaturedPlacement({ vendorId, payload, pricePerDay, currency, now }) {
      const owns = await this.vendorOwnsProduct(vendorId, payload.productId)
      if (!owns) {
        throw new BillingFailure('not_owner', 'Vendor does not own this product')
      }
      const startAt = now
      const endAt = addDays(startAt, payload.durationDays)
      const { totalDecimal } = computeAmount(pricePerDay, payload.durationDays, currency)
      const year = now.getUTCFullYear()
      const dueDate = addDays(now, 5)

      const result = await db.$transaction(async (tx) => {
        const number = await allocateInvoiceNumber(tx, year)
        const invoice = await tx.invoice.create({
          data: {
            number,
            type: 'featured',
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
                description: `Продвижение товара (${payload.placement}, ${payload.durationDays} дн.)`,
                quantity: payload.durationDays,
                unitPrice: new Prisma.Decimal(pricePerDay).toString(),
                total: totalDecimal.toString(),
              },
            ],
          },
        })
        const placement = await tx.featuredPlacement.create({
          data: {
            productId: payload.productId,
            vendorId,
            placement: payload.placement,
            startAt,
            endAt,
            status: 'pending',
            invoiceId: invoice.id,
          },
        })
        return { placement, invoice }
      })
      return {
        placement: toPlacementDto(result.placement as PlacementRow),
        invoice: toInvoiceDto(result.invoice as InvoiceRow),
      }
    },

    async confirmFeatured({ invoiceId, confirmerId, paymentReference, now }) {
      const result = await db.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) throw new BillingFailure('invoice_not_found', `Invoice ${invoiceId} not found`)
        if (invoice.type !== 'featured') throw new BillingFailure('not_payable', 'Not a featured invoice')
        if (invoice.status === 'paid') throw new BillingFailure('already_confirmed', 'Already confirmed')
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
        const placement = await tx.featuredPlacement.findFirst({
          where: { invoiceId },
        })
        if (!placement) throw new BillingFailure('not_found', 'Placement not found for invoice')
        const updatedPlacement = await tx.featuredPlacement.update({
          where: { id: placement.id },
          data: { status: 'active' },
        })
        // Bump Product.featuredUntil to the later of (existing, this placement's endAt).
        const product = await tx.product.findUnique({ where: { id: placement.productId } })
        if (product) {
          const existing = product.featuredUntil ? product.featuredUntil.getTime() : 0
          const candidate = updatedPlacement.endAt.getTime()
          const featuredUntil = new Date(Math.max(existing, candidate))
          await tx.product.update({
            where: { id: product.id },
            data: { featuredUntil },
          })
        }
        return { invoice: updatedInvoice, placement: updatedPlacement }
      })
      return {
        invoice: toInvoiceDto(result.invoice as InvoiceRow),
        placement: toPlacementDto(result.placement as PlacementRow),
      }
    },

    async activateAddOn({ vendorId, payload, price, currency, now }) {
      const year = now.getUTCFullYear()
      const totalDecimal = new Prisma.Decimal(price)
      const dueDate = addDays(now, 5)
      const expiresAt = payload.durationDays ? addDays(now, payload.durationDays) : null

      const result = await db.$transaction(async (tx) => {
        const number = await allocateInvoiceNumber(tx, year)
        const invoice = await tx.invoice.create({
          data: {
            number,
            type: 'add_on',
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
                description: `Активация модуля «${payload.feature}»`,
                quantity: 1,
                unitPrice: totalDecimal.toString(),
                total: totalDecimal.toString(),
              },
            ],
          },
        })
        const addOn = await tx.vendorAddOn.create({
          data: {
            vendorId,
            feature: payload.feature,
            status: 'pending',
            expiresAt,
            invoiceId: invoice.id,
          },
        })
        return { addOn, invoice }
      })
      return {
        addOn: toAddOnDto(result.addOn as AddOnRow),
        invoice: toInvoiceDto(result.invoice as InvoiceRow),
      }
    },

    async confirmAddOn({ invoiceId, confirmerId, paymentReference, now }) {
      const result = await db.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) throw new BillingFailure('invoice_not_found', `Invoice ${invoiceId} not found`)
        if (invoice.type !== 'add_on') throw new BillingFailure('not_payable', 'Not an add-on invoice')
        if (invoice.status === 'paid') throw new BillingFailure('already_confirmed', 'Already confirmed')
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
        const addOn = await tx.vendorAddOn.findFirst({ where: { invoiceId } })
        if (!addOn) throw new BillingFailure('not_found', 'Add-on not found for invoice')
        const updatedAddOn = await tx.vendorAddOn.update({
          where: { id: addOn.id },
          data: { status: 'active', activatedAt: now },
        })
        return { invoice: updatedInvoice, addOn: updatedAddOn }
      })
      return {
        invoice: toInvoiceDto(result.invoice as InvoiceRow),
        addOn: toAddOnDto(result.addOn as AddOnRow),
      }
    },

    async listInvoices({ payerUserId, vendorId, status, type }) {
      const where: Prisma.InvoiceWhereInput = {}
      if (payerUserId) where.payerUserId = payerUserId
      if (vendorId) where.vendorId = vendorId
      if (status && status.length > 0) where.status = { in: status }
      if (type && type.length > 0) where.type = { in: type }
      const rows = await db.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })
      return rows.map((r) => toInvoiceDto(r as InvoiceRow))
    },

    async findInvoiceById(id) {
      const row = await db.invoice.findUnique({ where: { id } })
      return row ? toInvoiceDto(row as InvoiceRow) : null
    },

    async vendorOwnsProduct(vendorId, productId) {
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { vendorId: true },
      })
      return product?.vendorId === vendorId
    },
  }
}
