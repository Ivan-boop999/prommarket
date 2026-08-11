/**
 * Billing domain failures (featured placements, add-ons, shared invoice listing).
 */
export type BillingFailureKind =
  | 'not_found'
  | 'vendor_not_found'
  | 'product_not_found'
  | 'not_owner'
  | 'invoice_not_found'
  | 'not_payable'
  | 'already_confirmed'

export class BillingFailure extends Error {
  constructor(readonly kind: BillingFailureKind, message: string) {
    super(message)
    this.name = 'BillingFailure'
  }
}

/** Default price per day for a featured placement, in RUB. */
export const DEFAULT_FEATURED_PRICE_PER_DAY = 500
/** Default price per add-on activation, in RUB. */
export const DEFAULT_ADDON_PRICE = 5000
