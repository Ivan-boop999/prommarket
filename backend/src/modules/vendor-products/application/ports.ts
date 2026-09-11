import type {
  CreateProductInput,
  ProductDetail,
  UpdateProductInput,
} from '@prommarket/contracts'

/**
 * Port owned by the application layer: the service depends on this shape, the
 * Prisma adapter in infrastructure implements it.
 */
export type VendorProductRepository = {
  listByVendor(vendorId: string): Promise<ProductDetail[]>
  findByVendor(vendorId: string, productId: string): Promise<ProductDetail | null>
  create(vendorId: string, input: CreateProductInput): Promise<ProductDetail>
  update(vendorId: string, productId: string, input: UpdateProductInput): Promise<ProductDetail>
  remove(vendorId: string, productId: string): Promise<void>
}
