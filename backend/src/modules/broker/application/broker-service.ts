import type {
  BrokerFeeLedgerEntry,
  BrokerFeeStats,
  BrokerFeesQuery,
  Invoice,
} from '@web-app-demo/contracts'

import { DEFAULT_BROKER_FEE_PERCENT, DEFAULT_CURRENCY } from '../domain/errors'
import type { BrokerRepository, Clock } from './ports'

export type BrokerServiceDependencies = {
  clock: Clock
  repository: BrokerRepository
  feePercent?: number
  currency?: string
}

export class BrokerService {
  private readonly feePercent: number
  private readonly currency: string

  constructor(private readonly deps: BrokerServiceDependencies) {
    this.feePercent = deps.feePercent ?? DEFAULT_BROKER_FEE_PERCENT
    this.currency = deps.currency ?? DEFAULT_CURRENCY
  }

  /**
   * Accrue a fee on a deal that just reached `completed`. Called by the deals
   * module's state machine on the connection → completed transition.
   */
  accrueFee(input: {
    dealId: string
    brokerId: string
    baseAmount: number
    now?: Date
  }): Promise<BrokerFeeLedgerEntry> {
    return this.deps.repository.accrueFee({
      dealId: input.dealId,
      brokerId: input.brokerId,
      baseAmount: input.baseAmount,
      feePercent: this.feePercent,
      now: input.now ?? this.deps.clock.now(),
    })
  }

  listFees(brokerId: string, query: BrokerFeesQuery) {
    return this.deps.repository.listFees({ brokerId, query })
  }

  stats(brokerId: string): Promise<BrokerFeeStats> {
    return this.deps.repository.stats(brokerId)
  }

  invoiceFee(feeId: string): Promise<{ fee: BrokerFeeLedgerEntry; invoice: Invoice }> {
    return this.deps.repository.invoiceFee({
      feeId,
      currency: this.currency,
      now: this.deps.clock.now(),
    })
  }

  confirmFeePayment(input: {
    feeId: string
    confirmerId: string
    paymentReference?: string
  }): Promise<{ fee: BrokerFeeLedgerEntry; invoice: Invoice }> {
    return this.deps.repository.confirmFeePayment({
      feeId: input.feeId,
      confirmerId: input.confirmerId,
      paymentReference: input.paymentReference,
      now: this.deps.clock.now(),
    })
  }
}
