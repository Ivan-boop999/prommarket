import type {
  BrokerFeeLedgerEntry,
  BrokerFeeStats,
  BrokerFeesQuery,
  Invoice,
} from '@prommarket/contracts'

/**
 * Broker success-fee ports.
 *
 * A fee is accrued when a deal transitions connection → completed (see
 * deals module, iteration 5). This module lists fees, generates invoices
 * against them, and marks them paid — all backend-authoritative.
 */
export type BrokerRepository = {
  /** Accrue a fee for a completed deal. Idempotent: re-accruing the same deal
   *  returns the existing row. */
  accrueFee(input: {
    dealId: string
    brokerId: string
    baseAmount: number
    feePercent: number
    now: Date
  }): Promise<BrokerFeeLedgerEntry>
  listFees(input: {
    brokerId: string
    query: BrokerFeesQuery
  }): Promise<{ items: BrokerFeeLedgerEntry[]; total: number }>
  stats(brokerId: string): Promise<BrokerFeeStats>
  /** Issue an invoice for an accrued fee. Moves fee to `invoiced`. */
  invoiceFee(input: {
    feeId: string
    currency: string
    now: Date
  }): Promise<{ fee: BrokerFeeLedgerEntry; invoice: Invoice }>
  /** Mark an invoiced fee as paid. */
  confirmFeePayment(input: {
    feeId: string
    confirmerId: string
    paymentReference?: string
    now: Date
  }): Promise<{ fee: BrokerFeeLedgerEntry; invoice: Invoice }>
}

export type Clock = { now(): Date }
