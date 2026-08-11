import type {
  Invoice,
  LeadCreditBalance,
  LeadCreditLedgerEntry,
  LeadCreditPrice,
  PurchaseLeadCreditsInput,
} from '@web-app-demo/contracts'

import type { Clock, LeadRepository } from './ports'

/**
 * Default per-credit price in RUB. Tunable here so a single number drives both
 * the public price endpoint and the purchase invoice total.
 */
export const DEFAULT_PRICE_PER_CREDIT = 100
export const DEFAULT_CURRENCY = 'RUB'

export type LeadsServiceDependencies = {
  clock: Clock
  repository: LeadRepository
  pricePerCredit?: number
  currency?: string
}

export class LeadsService {
  private readonly pricePerCredit: number
  private readonly currency: string

  constructor(private readonly deps: LeadsServiceDependencies) {
    this.pricePerCredit = deps.pricePerCredit ?? DEFAULT_PRICE_PER_CREDIT
    this.currency = deps.currency ?? DEFAULT_CURRENCY
  }

  getPrice(): LeadCreditPrice {
    return {
      pricePerCredit: String(this.pricePerCredit),
      currency: this.currency,
      tiers: [
        { minCredits: 50, pricePerCredit: String(Math.round(this.pricePerCredit * 0.9)) },
        { minCredits: 200, pricePerCredit: String(Math.round(this.pricePerCredit * 0.75)) },
      ],
    }
  }

  balance(vendorId: string): Promise<LeadCreditBalance> {
    return this.deps.repository.balance(vendorId)
  }

  ledger(vendorId: string): Promise<LeadCreditLedgerEntry[]> {
    return this.deps.repository.ledger(vendorId)
  }

  purchase(vendorId: string, input: PurchaseLeadCreditsInput): Promise<{ invoice: Invoice }> {
    return this.deps.repository.createPurchaseInvoice({
      vendorId,
      credits: input.credits,
      unitPrice: this.pricePerCredit,
      currency: this.currency,
    })
  }

  /**
   * Unlock an RFQ's contacts. cost is 1 credit by default; the service keeps it
   * as a parameter so a future tiered-cost rule can live in one place.
   */
  unlock(
    vendorId: string,
    referenceId: string,
    cost = 1,
  ): Promise<{ ledgerEntry: LeadCreditLedgerEntry; balance: number }> {
    return this.deps.repository.unlockLead({ vendorId, referenceId, cost })
  }

  confirmPurchase(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
  }): Promise<{ invoice: Invoice; balance: number }> {
    return this.deps.repository.confirmPurchase({
      invoiceId: input.invoiceId,
      confirmerId: input.confirmerId,
      paymentReference: input.paymentReference,
      now: this.deps.clock.now(),
    })
  }
}
