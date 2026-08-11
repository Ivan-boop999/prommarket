export type AdminCatalogFailureKind =
  | 'not_found'
  | 'slug_taken'
  | 'has_children'

export class AdminCatalogFailure extends Error {
  constructor(readonly kind: AdminCatalogFailureKind, message: string) {
    super(message)
    this.name = 'AdminCatalogFailure'
  }
}
