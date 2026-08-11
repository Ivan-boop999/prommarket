import type {
  CreateProductInput,
  ProductDetail,
  UpdateProductInput,
} from '@web-app-demo/contracts'
import type { VendorProductRepository } from '../infrastructure/vendor-products-repository'

export class VendorProductsService {
  constructor(private readonly repository: VendorProductRepository) {}

  list(vendorId: string): Promise<ProductDetail[]> {
    return this.repository.listByVendor(vendorId)
  }

  get(vendorId: string, productId: string): Promise<ProductDetail | null> {
    return this.repository.findByVendor(vendorId, productId)
  }

  create(vendorId: string, input: CreateProductInput): Promise<ProductDetail> {
    return this.repository.create(vendorId, input)
  }

  update(vendorId: string, productId: string, input: UpdateProductInput): Promise<ProductDetail> {
    return this.repository.update(vendorId, productId, input)
  }

  remove(vendorId: string, productId: string): Promise<void> {
    return this.repository.remove(vendorId, productId)
  }
}
