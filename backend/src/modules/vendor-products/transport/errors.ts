import { AppError } from '../../../http/errors'
import { VendorProductFailure } from '../domain/errors'

export function toVendorProductAppError(error: unknown) {
  if (!(error instanceof VendorProductFailure)) return error
  switch (error.kind) {
    case 'not_found':
    case 'vendor_not_found':
    case 'category_not_found':
    case 'attribute_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'not_owner':
      return new AppError(403, 'FORBIDDEN', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeVendorProducts<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toVendorProductAppError(error)
  }
}
