import { AppError } from '../../../http/errors'
import { BrokerFailure } from '../domain/errors'

export function toBrokerAppError(error: unknown) {
  if (!(error instanceof BrokerFailure)) return error

  switch (error.kind) {
    case 'not_found':
    case 'deal_not_found':
    case 'fee_not_found':
    case 'invoice_not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'not_brokered':
      return new AppError(403, 'FORBIDDEN', error.message)
    case 'not_completed':
    case 'not_payable':
    case 'already_confirmed':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeBroker<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toBrokerAppError(error)
  }
}
