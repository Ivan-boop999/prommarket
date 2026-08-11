/**
 * Lead-credit domain failures.
 */
export type LeadFailureKind =
  | 'vendor_not_found'
  | 'invoice_not_found'
  | 'not_payable'
  | 'already_confirmed'
  | 'insufficient_credits'
  | 'already_unlocked'

export class LeadFailure extends Error {
  constructor(readonly kind: LeadFailureKind, message: string) {
    super(message)
    this.name = 'LeadFailure'
  }
}
