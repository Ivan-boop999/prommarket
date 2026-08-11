import type {
  ActivateAddOnInput,
  CreateFeaturedPlacementInput,
  FeaturedPlacement,
  Invoice,
  VendorAddOn,
} from '@web-app-demo/contracts'

/**
 * Billing ports: featured placements, SaaS add-ons, shared invoice listing.
 * Subscriptions and lead-credit purchases own their own repositories; this
 * module owns the cross-cutting surfaces.
 */
export type BillingRepository = {
  createFeaturedPlacement(input: {
    vendorId: string
    payload: CreateFeaturedPlacementInput
    pricePerDay: number
    currency: string
    now: Date
  }): Promise<{ placement: FeaturedPlacement; invoice: Invoice }>
  /** Confirm a featured-placement invoice: activate the placement + bump Product.featuredUntil. */
  confirmFeatured(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
    now: Date
  }): Promise<{ invoice: Invoice; placement: FeaturedPlacement }>

  activateAddOn(input: {
    vendorId: string
    payload: ActivateAddOnInput
    price: number
    currency: string
    now: Date
  }): Promise<{ addOn: VendorAddOn; invoice: Invoice }>
  confirmAddOn(input: {
    invoiceId: string
    confirmerId: string
    paymentReference?: string
    now: Date
  }): Promise<{ invoice: Invoice; addOn: VendorAddOn }>

  listInvoices(input: {
    payerUserId?: string
    vendorId?: string
    status?: Invoice['status'][]
    type?: Invoice['type'][]
  }): Promise<Invoice[]>
  findInvoiceById(id: string): Promise<Invoice | null>
  /** Does this vendor own this product? */
  vendorOwnsProduct(vendorId: string, productId: string): Promise<boolean>
}

export type Clock = { now(): Date }
