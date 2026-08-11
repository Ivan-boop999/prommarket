export type ReviewFailureKind = 'not_found' | 'already_reviewed' | 'not_owner' | 'not_buyer'

export class ReviewFailure extends Error {
  constructor(readonly kind: ReviewFailureKind, message: string) {
    super(message)
    this.name = 'ReviewFailure'
  }
}
