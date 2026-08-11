/**
 * Subscription domain failures. Mapped to HTTP in `transport/errors.ts`.
 */
export type SubscriptionFailureKind =
  | 'not_found'
  | 'plan_not_found'
  | 'plan_inactive'
  | 'already_pending'
  | 'vendor_not_found'
  | 'invoice_not_found'
  | 'not_payable'
  | 'already_confirmed'

export class SubscriptionFailure extends Error {
  constructor(readonly kind: SubscriptionFailureKind, message: string) {
    super(message)
    this.name = 'SubscriptionFailure'
  }
}
