/**
 * Catalog domain failures. Catalog endpoints are mostly read-only, so the only
 * failure that surfaces to HTTP today is a missing product. New failure kinds
 * (e.g. `forbidden` when vendor-scoped writes land) should be added here and
 * mapped in `transport/errors.ts`.
 */
export type CatalogFailureKind = 'not_found'

export class CatalogFailure extends Error {
  constructor(readonly kind: CatalogFailureKind, message: string) {
    super(message)
    this.name = 'CatalogFailure'
  }
}
