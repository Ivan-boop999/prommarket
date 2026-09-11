import type {
  Invoice,
  LeadCreditBalance,
  LeadCreditLedgerEntry,
} from '@prommarket/contracts'

/**
 * Lead-credit ports.
 *
 * The balance is SUM(delta) over the ledger; there is no balance column to keep
 * writes race-free. Spend happens inside a Postgres advisory lock keyed on the
 * vendor so two concurrent unlocks cannot both succeed against one credit.
 */
export type LeadRepository = {
  balance(vendorId: string): Promise<LeadCreditBalance>
  ledger(vendorId: string): Promise<LeadCreditLedgerEntry[]>
  /**
   * Atomically decrement credits for an RFQ unlock. Throws LeadFailure
   * ('insufficient_credits' | 'already_unlocked') on failure.
   */
  unlockLead(input: {
    vendorId: string
    referenceId: string
    cost: number
  }): Promise<{ ledgerEntry: LeadCreditLedgerEntry; balance: number }>
  /**
   * Create an issued invoice for a credit purchase. Credits are granted only
   * when an admin confirms payment (see confirmPurchase).
   */
  createPurchaseInvoice(input: {
    vendorId: string
    credits: number
    unitPrice: number
    currency: string
  }): Promise<{ invoice: Invoice }>
  /** Confirm a credit purchase invoice: mark paid + grant the credits. */
  confirmPurchase(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
    now: Date
  }): Promise<{ invoice: Invoice; balance: number }>
}

export type Clock = { now(): Date }
