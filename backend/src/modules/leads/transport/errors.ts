import { AppError } from '../../../http/errors'
import { LeadFailure } from '../domain/errors'

export function toLeadAppError(error: unknown) {
  if (!(error instanceof LeadFailure)) return error

  switch (error.kind) {
    case 'vendor_not_found':
    case 'invoice_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'insufficient_credits':
      return new AppError(402, 'PAYMENT_REQUIRED', error.message)
    case 'already_unlocked':
      return new AppError(409, 'CONFLICT', error.message)
    case 'not_payable':
    case 'already_confirmed':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeLeads<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toLeadAppError(error)
  }
}
