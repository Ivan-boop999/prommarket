import { AppError } from '../../../http/errors'
import { AdminCatalogFailure } from '../domain/errors'

export function toAdminCatalogAppError(error: unknown) {
  if (!(error instanceof AdminCatalogFailure)) return error
  switch (error.kind) {
    case 'not_found':
      return new AppError(404, 'NOT_FOUND', error.message)
    case 'slug_taken':
    case 'has_children':
      return new AppError(409, 'CONFLICT', error.message)
    default:
      return new AppError(409, 'CONFLICT', error.message)
  }
}

export async function executeAdminCatalog<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toAdminCatalogAppError(error)
  }
}
