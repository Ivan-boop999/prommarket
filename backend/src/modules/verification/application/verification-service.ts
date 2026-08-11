import type {
  CreateVerificationRequestInput,
  ReviewVerificationInput,
  VerificationRequest,
} from '@web-app-demo/contracts'

import { VERIFICATION_VALIDITY_MONTHS, VerificationFailure } from '../domain/errors'
import type { Clock, VerificationRepository } from './ports'
import { addMonths } from '../../billing/infrastructure/mappers'

export type VerificationServiceDependencies = {
  clock: Clock
  repository: VerificationRepository
}

export class VerificationService {
  constructor(private readonly deps: VerificationServiceDependencies) {}

  createRequest(vendorId: string, payload: CreateVerificationRequestInput): Promise<VerificationRequest> {
    return this.deps.repository.createRequest({ vendorId, payload })
  }

  submit(id: string): Promise<VerificationRequest> {
    return this.deps.repository.submit(id, this.deps.clock.now())
  }

  getById(id: string): Promise<VerificationRequest | null> {
    return this.deps.repository.findRequestById(id)
  }

  getLatestByVendor(vendorId: string): Promise<VerificationRequest | null> {
    return this.deps.repository.findLatestByVendor(vendorId)
  }

  listPending(): Promise<VerificationRequest[]> {
    return this.deps.repository.listPending()
  }

  review(
    id: string,
    reviewerId: string,
    input: ReviewVerificationInput,
  ): Promise<VerificationRequest> {
    const now = this.deps.clock.now()
    const expiresAt = input.decision === 'approved' ? addMonths(now, VERIFICATION_VALIDITY_MONTHS) : null
    return this.deps.repository.review({
      id,
      reviewerId,
      decision: input.decision,
      reviewerNotes: input.reviewerNotes,
      now,
      expiresAt,
    })
  }
}
