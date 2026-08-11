import { AppError } from '../../../http/errors'
import { CatalogFailure } from '../domain/errors'

export function toCatalogAppError(error: unknown) {
  if (!(error instanceof CatalogFailure)) return error

  if (error.kind === 'not_found') {
    return new AppError(404, 'NOT_FOUND', error.message)
  }
  return new AppError(409, 'CONFLICT', error.message)
}

export async function executeCatalog<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toCatalogAppError(error)
  }
}
