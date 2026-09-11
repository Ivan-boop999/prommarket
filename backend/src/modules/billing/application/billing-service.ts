import type {
  ActivateAddOnInput,
  CreateFeaturedPlacementInput,
  FeaturedPlacement,
  Invoice,
  InvoiceStatus,
  InvoiceType,
  VendorAddOn,
} from '@prommarket/contracts'

import {
  DEFAULT_ADDON_PRICE,
  DEFAULT_CURRENCY,
  DEFAULT_FEATURED_PRICE_PER_DAY,
} from '../domain/errors'
import type { BillingRepository, Clock } from './ports'

export type BillingServiceDependencies = {
  clock: Clock
  repository: BillingRepository
  featuredPricePerDay?: number
  addonPrice?: number
  currency?: string
}

export class BillingService {
  private readonly featuredPricePerDay: number
  private readonly addonPrice: number
  private readonly currency: string

  constructor(private readonly deps: BillingServiceDependencies) {
    this.featuredPricePerDay = deps.featuredPricePerDay ?? DEFAULT_FEATURED_PRICE_PER_DAY
    this.addonPrice = deps.addonPrice ?? DEFAULT_ADDON_PRICE
    this.currency = deps.currency ?? DEFAULT_CURRENCY
  }

  createFeaturedPlacement(
    vendorId: string,
    payload: CreateFeaturedPlacementInput,
  ): Promise<{ placement: FeaturedPlacement; invoice: Invoice }> {
    return this.deps.repository.createFeaturedPlacement({
      vendorId,
      payload,
      pricePerDay: this.featuredPricePerDay,
      currency: this.currency,
      now: this.deps.clock.now(),
    })
  }

  confirmFeatured(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
  }): Promise<{ invoice: Invoice; placement: FeaturedPlacement }> {
    return this.deps.repository.confirmFeatured({
      invoiceId: input.invoiceId,
      confirmerId: input.confirmerId,
      paymentReference: input.paymentReference,
      now: this.deps.clock.now(),
    })
  }

  activateAddOn(
    vendorId: string,
    payload: ActivateAddOnInput,
  ): Promise<{ addOn: VendorAddOn; invoice: Invoice }> {
    return this.deps.repository.activateAddOn({
      vendorId,
      payload,
      price: this.addonPrice,
      currency: this.currency,
      now: this.deps.clock.now(),
    })
  }

  confirmAddOn(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
  }): Promise<{ invoice: Invoice; addOn: VendorAddOn }> {
    return this.deps.repository.confirmAddOn({
      invoiceId: input.invoiceId,
      confirmerId: input.confirmerId,
      paymentReference: input.paymentReference,
      now: this.deps.clock.now(),
    })
  }

  listInvoices(input: {
    payerUserId?: string
    vendorId?: string
    status?: InvoiceStatus[]
    type?: InvoiceType[]
  }): Promise<Invoice[]> {
    return this.deps.repository.listInvoices(input)
  }
}
