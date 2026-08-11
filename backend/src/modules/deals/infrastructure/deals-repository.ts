import type {
  Deal,
  DealDetail,
  DealHistoryEntry,
  DealMessage,
  DealsQuery,
} from '@web-app-demo/contracts'

import type { DbClient } from '../../../db'
import { DealFailure } from '../domain/errors'
import type { DealRepository } from '../application/ports'

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

type DealRow = {
  id: string
  dealNumber: string
  type: string
  status: string
  title: string
  productId: string | null
  buyerId: string | null
  vendorId: string | null
  brokerId: string | null
  quantity: number | null
  totalAmount: { toString(): string } | null
  currency: string
  commission: { toString(): string } | null
  createdAt: Date
  updatedAt: Date
  product?: { title: string | null } | null
  buyer?: { companyName: string | null } | null
  vendor?: { companyName: string | null } | null
}

function toDealDto(row: DealRow): Deal {
  return {
    id: row.id,
    dealNumber: row.dealNumber,
    type: row.type as Deal['type'],
    status: row.status as Deal['status'],
    title: row.title,
    productId: row.productId,
    productTitle: row.product?.title ?? null,
    buyerId: row.buyerId,
    buyerName: row.buyer?.companyName ?? null,
    vendorId: row.vendorId,
    vendorName: row.vendor?.companyName ?? null,
    brokerId: row.brokerId,
    quantity: row.quantity,
    totalAmount: row.totalAmount ? row.totalAmount.toString() : null,
    currency: row.currency,
    commission: row.commission ? row.commission.toString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

type MessageRow = {
  id: string
  dealId: string
  senderId: string
  senderRole: string
  content: string
  createdAt: Date
}

function toMessageDto(row: MessageRow): DealMessage {
  return {
    id: row.id,
    dealId: row.dealId,
    senderId: row.senderId,
    senderRole: row.senderRole as DealMessage['senderRole'],
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }
}

type HistoryRow = {
  id: string
  dealId: string
  action: string
  userId: string | null
  details: string | null
  createdAt: Date
}

function toHistoryDto(row: HistoryRow): DealHistoryEntry {
  return {
    id: row.id,
    dealId: row.dealId,
    action: row.action,
    userId: row.userId,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  }
}

function toDetailDto(row: DealRow & { description?: string | null; deliveryDate?: Date | null; deliveryAddress?: string | null; notes?: string | null; messages?: MessageRow[]; history?: HistoryRow[] }): DealDetail {
  return {
    ...toDealDto(row),
    description: row.description ?? null,
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString() : null,
    deliveryAddress: row.deliveryAddress ?? null,
    notes: row.notes ?? null,
    messages: (row.messages ?? []).map(toMessageDto),
    history: (row.history ?? []).map(toHistoryDto),
  }
}

const detailInclude = {
  product: { select: { title: true } },
  buyer: { select: { companyName: true } },
  vendor: { select: { companyName: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  history: { orderBy: { createdAt: 'asc' as const } },
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export function createPrismaDealsRepository(db: DbClient): DealRepository {
  return {
    async list(query) {
      const where: Record<string, unknown> = {}
      if (query.status && query.status.length > 0) where.status = { in: query.status }
      if (query.type && query.type.length > 0) where.type = { in: query.type }
      if (query.vendorId) where.vendorId = query.vendorId
      if (query.buyerId) where.buyerId = query.buyerId
      if (query.brokerId) where.brokerId = query.brokerId

      const [rows, total] = await Promise.all([
        db.deal.findMany({
          where,
          include: {
            product: { select: { title: true } },
            buyer: { select: { companyName: true } },
            vendor: { select: { companyName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        db.deal.count({ where }),
      ])
      return {
        items: rows.map((r) => toDealDto(r as DealRow)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      }
    },

    async findDetailById(id) {
      const row = await db.deal.findUnique({
        where: { id },
        include: detailInclude,
      })
      return row ? toDetailDto(row as DealRow & Record<string, unknown>) : null
    },

    async create(input) {
      // Resolve the buyer profile for the authenticated user.
      const buyer = await db.buyer.findUnique({ where: { userId: input.buyerUserId } })
      if (!buyer) {
        throw new DealFailure('buyer_not_found', 'Authenticated user has no buyer profile')
      }
      const year = input.now.getUTCFullYear()
      const result = await db.$transaction(async (tx) => {
        // Atomic deal number allocation: upsert the year row then increment.
        await tx.dealNumberSequence.upsert({
          where: { year },
          create: { year, next: 1 },
          update: {},
        })
        const seqRows = await tx.$queryRaw<{ next: number }[]>`
          UPDATE deal_number_sequence
             SET next = next + 1
           WHERE year = ${year}
          RETURNING next
        `
        const next = seqRows[0]?.next ?? 1
        const dealNumber = `SD-${year}-${String(next - 1).padStart(4, '0')}`

        const deal = await tx.deal.create({
          data: {
            dealNumber,
            type: input.type,
            status: 'new',
            title: input.title,
            description: input.description ?? null,
            productId: input.productId,
            buyerId: buyer.id,
            vendorId: input.vendorId,
            quantity: input.quantity,
            deliveryDate: input.deliveryDate,
            deliveryAddress: input.deliveryAddress,
            notes: input.notes,
          },
        })
        await tx.dealHistory.create({
          data: {
            dealId: deal.id,
            action: 'CREATED',
            userId: input.buyerUserId,
            details: `Сделка ${dealNumber} создана`,
          },
        })
        return deal
      })
      const detail = await db.deal.findUnique({ where: { id: result.id }, include: detailInclude })
      if (!detail) throw new DealFailure('not_found', 'Deal vanished after create')
      return toDetailDto(detail as DealRow & Record<string, unknown>)
    },

    async changeStatus({ id, to, userId, notes, now }) {
      const existing = await db.deal.findUnique({ where: { id } })
      if (!existing) throw new DealFailure('not_found', `Deal ${id} not found`)
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.deal.update({
          where: { id },
          data: { status: to },
        })
        await tx.dealHistory.create({
          data: {
            dealId: id,
            action: 'STATUS_CHANGE',
            userId,
            details: `${existing.status} → ${to}${notes ? ` (${notes})` : ''}`,
          },
        })
        return updated
      })
      const detail = await db.deal.findUnique({ where: { id: result.id }, include: detailInclude })
      if (!detail) throw new DealFailure('not_found', 'Deal vanished after status change')
      return toDetailDto(detail as DealRow & Record<string, unknown>)
    },

    async addMessage({ dealId, senderId, senderRole, content, now }) {
      const message = await db.dealMessage.create({
        data: { dealId, senderId, senderRole, content },
      })
      await db.dealHistory.create({
        data: {
          dealId,
          action: 'MESSAGE',
          userId: senderId,
          details: content.slice(0, 100),
        },
      })
      return toMessageDto(message as MessageRow)
    },

    async history(dealId) {
      const rows = await db.dealHistory.findMany({
        where: { dealId },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map((r) => toHistoryDto(r as HistoryRow))
    },
  }
}
