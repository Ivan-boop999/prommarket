import type {
  CreateSubscriptionInput,
  Invoice,
  SubscriptionPlan,
  VendorSubscription,
} from '@web-app-demo/contracts'

import { SubscriptionFailure } from '../domain/errors'
import type { Clock, SubscriptionRepository } from './ports'

/**
 * Subscriptions application service.
 *
 * Thin orchestration over the repository. The service is where cross-entity
 * validation lives (plan must be active; vendor must not already have a pending
 * subscription for the same plan). Money is never computed here — the plan's
 * price is a snapshot taken by the repository at create time.
 */
export type SubscriptionServiceDependencies = {
  clock: Clock
  repository: SubscriptionRepository
}

export class SubscriptionsService {
  constructor(private readonly deps: SubscriptionServiceDependencies) {}

  listPlans(): Promise<SubscriptionPlan[]> {
    return this.deps.repository.listActivePlans()
  }

  async getCurrentSubscription(vendorId: string): Promise<VendorSubscription | null> {
    return this.deps.repository.findActiveSubscriptionByVendor(vendorId)
  }

  async subscribe(
    vendorId: string,
    input: CreateSubscriptionInput,
  ): Promise<{ subscription: VendorSubscription; invoice: Invoice }> {
    const plan = await this.deps.repository.findPlanById(input.planId)
    if (!plan) {
      throw new SubscriptionFailure('plan_not_found', `Plan ${input.planId} not found`)
    }
    if (!plan.isActive) {
      throw new SubscriptionFailure('plan_inactive', `Plan ${plan.code} is not active`)
    }
    const existing = await this.deps.repository.findPendingSubscription(vendorId, plan.id)
    if (existing) {
      throw new SubscriptionFailure(
        'already_pending',
        'A pending subscription for this plan already awaits payment',
      )
    }
    const now = this.deps.clock.now()
    return this.deps.repository.createPendingSubscription({ vendorId, plan, periodStart: now })
  }

  /**
   * Confirm an invoice was paid. Called by the admin endpoint after a bank
   * transfer lands. Returns the updated invoice and the now-active subscription.
   */
  confirmPayment(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
  }): Promise<{ invoice: Invoice; subscription: VendorSubscription }> {
    return this.deps.repository.confirmInvoicePayment({
      invoiceId: input.invoiceId,
      confirmerId: input.confirmerId,
      paymentReference: input.paymentReference,
      now: this.deps.clock.now(),
    })
  }

  listInvoices(vendorId: string): Promise<Invoice[]> {
    return this.deps.repository.listVendorInvoices(vendorId)
  }
}
