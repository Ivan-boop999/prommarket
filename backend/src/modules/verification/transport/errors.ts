import { AppError } from '../../../http/errors'
import { VerificationFailure } from '../domain/errors'

export function toVerificationAppError(error: unknown) {
  if (!(error instanceof VerificationFailure)) return error

  switch (error.kind) {
    case 'not_found':
    case 'vendor_not_found':
    case 'request_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'already_submitted':
    case 'not_submittable':
    case 'not_reviewable':
    case 'already_reviewed':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeVerification<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toVerificationAppError(error)
  }
}
