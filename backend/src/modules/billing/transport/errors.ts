import { AppError } from '../../../http/errors'
import { BillingFailure } from '../domain/errors'

export function toBillingAppError(error: unknown) {
  if (!(error instanceof BillingFailure)) return error

  switch (error.kind) {
    case 'not_found':
    case 'vendor_not_found':
    case 'product_not_found':
    case 'invoice_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'not_owner':
      return new AppError(403, 'FORBIDDEN', error.message)
    case 'not_payable':
    case 'already_confirmed':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeBilling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toBillingAppError(error)
  }
}
