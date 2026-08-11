import { AppError } from '../../../http/errors'
import { SubscriptionFailure } from '../domain/errors'

export function toSubscriptionAppError(error: unknown) {
  if (!(error instanceof SubscriptionFailure)) return error

  switch (error.kind) {
    case 'not_found':
    case 'plan_not_found':
    case 'invoice_not_found':
    case 'vendor_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'plan_inactive':
      return new AppError(409, 'CONFLICT', error.message)
    case 'already_pending':
    case 'already_confirmed':
    case 'not_payable':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeSubscriptions<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toSubscriptionAppError(error)
  }
}
