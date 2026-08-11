import type {
  ReviewVerificationInput,
  VerificationRequest,
  CreateVerificationRequestInput,
} from '@web-app-demo/contracts'

/**
 * Verification ports.
 *
 * Documents are uploaded out-of-band through the uploads module (same ticket/
 * upload/finalize contract as avatars, extended to accept PDF); the object keys
 * are attached to a verification request here.
 */
export type VerificationRepository = {
  createRequest(input: {
    vendorId: string
    payload: CreateVerificationRequestInput
  }): Promise<VerificationRequest>
  findRequestById(id: string): Promise<VerificationRequest | null>
  findLatestByVendor(vendorId: string): Promise<VerificationRequest | null>
  submit(id: string, now: Date): Promise<VerificationRequest>
  review(input: {
    id: string
    reviewerId: string
    decision: ReviewVerificationInput['decision']
    reviewerNotes?: string
    now: Date
    expiresAt: Date | null
  }): Promise<VerificationRequest>
  /** Pending/under-review requests for the moderator queue. */
  listPending(): Promise<VerificationRequest[]>
}

export type Clock = { now(): Date }
