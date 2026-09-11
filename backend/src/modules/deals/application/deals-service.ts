import {
  isDealStatusTransitionAllowed,
  type ChangeDealStatusInput,
  type CreateDealMessageInput,
  type DealDetail,
  type DealMessage,
  type DealsQuery,
  type CreateDealInput,
} from '@prommarket/contracts'

import { DealFailure } from '../domain/errors'
import type { Clock, DealRepository } from './ports'

/**
 * Deals application service. The state machine from contracts
 * (DEAL_STATUS_TRANSITIONS) is enforced here so the rule lives in one place;
 * the repository just writes the row + history entry.
 */
export type DealsServiceDependencies = {
  clock: Clock
  repository: DealRepository
}

export class DealsService {
  constructor(private readonly deps: DealsServiceDependencies) {}

  list(query: DealsQuery) {
    return this.deps.repository.list(query)
  }

  getDetail(id: string): Promise<DealDetail | null> {
    return this.deps.repository.findDetailById(id)
  }

  create(buyerUserId: string, input: CreateDealInput): Promise<DealDetail> {
    return this.deps.repository.create({
      buyerUserId,
      type: input.type,
      title: input.title,
      description: input.description,
      productId: input.productId,
      vendorId: input.vendorId,
      quantity: input.quantity,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes,
      now: this.deps.clock.now(),
    })
  }

  async changeStatus(
    id: string,
    userId: string,
    input: ChangeDealStatusInput,
  ): Promise<DealDetail> {
    const deal = await this.deps.repository.findDetailById(id)
    if (!deal) throw new DealFailure('not_found', `Deal ${id} not found`)
    if (!isDealStatusTransitionAllowed(deal.status, input.status)) {
      throw new DealFailure(
        'invalid_transition',
        `Transition ${deal.status} → ${input.status} is not allowed`,
      )
    }
    return this.deps.repository.changeStatus({
      id,
      to: input.status,
      userId,
      notes: input.notes,
      now: this.deps.clock.now(),
    })
  }

  addMessage(
    dealId: string,
    senderId: string,
    senderRole: DealMessage['senderRole'],
    input: CreateDealMessageInput,
  ): Promise<DealMessage> {
    return this.deps.repository.addMessage({
      dealId,
      senderId,
      senderRole,
      content: input.content,
      now: this.deps.clock.now(),
    })
  }
}
