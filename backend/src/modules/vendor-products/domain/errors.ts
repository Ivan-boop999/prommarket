export type VendorProductFailureKind =
  | 'not_found'
  | 'vendor_not_found'
  | 'category_not_found'
  | 'attribute_not_found'
  | 'not_owner'

export class VendorProductFailure extends Error {
  constructor(readonly kind: VendorProductFailureKind, message: string) {
    super(message)
    this.name = 'VendorProductFailure'
  }
}
