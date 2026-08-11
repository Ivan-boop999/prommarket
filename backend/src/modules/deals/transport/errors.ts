import { AppError } from '../../../http/errors'
import { DealFailure } from '../domain/errors'

export function toDealAppError(error: unknown) {
  if (!(error instanceof DealFailure)) return error

  switch (error.kind) {
    case 'not_found':
    case 'buyer_not_found':
    case 'vendor_not_found':
    case 'product_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'invalid_transition':
      return new AppError(409, 'CONFLICT', error.message)
    case 'forbidden':
      return new AppError(403, 'FORBIDDEN', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeDeals<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toDealAppError(error)
  }
}
