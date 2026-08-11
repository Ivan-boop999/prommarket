/**
 * Verification domain failures.
 */
export type VerificationFailureKind =
  | 'not_found'
  | 'vendor_not_found'
  | 'request_not_found'
  | 'already_submitted'
  | 'not_submittable'
  | 'not_reviewable'
  | 'already_reviewed'

export class VerificationFailure extends Error {
  constructor(readonly kind: VerificationFailureKind, message: string) {
    super(message)
    this.name = 'VerificationFailure'
  }
}

/** How long an approved verification stays valid before it must be renewed. */
export const VERIFICATION_VALIDITY_MONTHS = 12
