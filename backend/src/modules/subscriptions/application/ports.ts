import type {
  Invoice,
  SubscriptionPlan,
  VendorSubscription,
} from '@prommarket/contracts'

/**
 * Subscription write ports.
 *
 * The repository owns all Prisma access and returns contract DTOs; the service
 * never sees raw rows. Money is returned as decimal strings per the contract.
 */
export type SubscriptionRepository = {
  /** All active plans, sorted by sortOrder, for the public catalog. */
  listActivePlans(): Promise<SubscriptionPlan[]>
  findPlanById(id: string): Promise<SubscriptionPlan | null>
  /** A vendor's current (non-terminal) subscription, with its plan, or null. */
  findActiveSubscriptionByVendor(vendorId: string): Promise<VendorSubscription | null>
  /** A vendor's pending-payment subscription for a plan, if one exists. */
  findPendingSubscription(vendorId: string, planId: string): Promise<VendorSubscription | null>
  findVendorByUserId(userId: string): Promise<{ id: string } | null>
  /**
   * Create a pending subscription + issued invoice in one transaction. The
   * invoice is the document the vendor pays against; the subscription moves
   * to `active` only when an admin confirms receipt.
   */
  createPendingSubscription(input: {
    vendorId: string
    plan: SubscriptionPlan
    periodStart: Date
  }): Promise<{ subscription: VendorSubscription; invoice: Invoice }>
  /** Mark an issued invoice paid and activate its subscription in one tx. */
  confirmInvoicePayment(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
    now: Date
  }): Promise<{ invoice: Invoice; subscription: VendorSubscription }>
  listVendorInvoices(vendorId: string): Promise<Invoice[]>
}

export type Clock = { now(): Date }
