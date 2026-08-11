/**
 * Deal domain failures.
 */
export type DealFailureKind =
  | 'not_found'
  | 'invalid_transition'
  | 'forbidden'
  | 'buyer_not_found'
  | 'vendor_not_found'
  | 'product_not_found'

export class DealFailure extends Error {
  constructor(readonly kind: DealFailureKind, message: string) {
    super(message)
    this.name = 'DealFailure'
  }
}
