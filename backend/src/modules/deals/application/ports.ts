import type {
  CreateDealMessageInput,
  Deal,
  DealDetail,
  DealHistoryEntry,
  DealMessage,
  DealsQuery,
} from '@prommarket/contracts'

/**
 * Deal ports. The repository owns Prisma access and the atomic deal-number
 * allocation (DealNumberSequence). Money crosses as Decimal; DTOs convert to
 * strings.
 */
export type DealRepository = {
  list(query: DealsQuery): Promise<{
    items: Deal[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }>
  findDetailById(id: string): Promise<DealDetail | null>
  create(input: {
    buyerUserId: string
    type: Deal['type']
    title: string
    description?: string
    productId?: string
    vendorId?: string
    quantity?: number
    deliveryDate?: Date
    deliveryAddress?: string
    notes?: string
    now: Date
  }): Promise<DealDetail>
  changeStatus(input: {
    id: string
    to: Deal['status']
    userId: string
    notes?: string
    now: Date
  }): Promise<DealDetail>
  addMessage(input: {
    dealId: string
    senderId: string
    senderRole: DealMessage['senderRole']
    content: string
    now: Date
  }): Promise<DealMessage>
  history(dealId: string): Promise<DealHistoryEntry[]>
}

export type Clock = { now(): Date }

export type { CreateDealMessageInput }
