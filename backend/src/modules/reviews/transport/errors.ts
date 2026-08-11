import { AppError } from '../../../http/errors'
import { ReviewFailure } from '../domain/errors'

export function toReviewAppError(error: unknown) {
  if (!(error instanceof ReviewFailure)) return error
  switch (error.kind) {
    case 'not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'already_reviewed':
      return new AppError(409, 'CONFLICT', error.message)
    case 'not_owner':
    case 'not_buyer':
      return new AppError(403, 'FORBIDDEN', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeReviews<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toReviewAppError(error)
  }
}
