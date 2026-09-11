import {
  createProductInputSchema,
  productDetailSchema,
  updateProductInputSchema,
  type CreateProductInput,
  type ProductDetail,
  type UpdateProductInput,
} from '@prommarket/contracts'
import { z } from 'zod'

import type { AuthenticatedTransport } from '@/platform/api'

/** Vendor product management API (CRUD with ownership scoped server-side). */

export function listVendorProducts(transport: AuthenticatedTransport): Promise<ProductDetail[]> {
  return transport.request('/api/vendor-products', z.array(productDetailSchema))
}

export function getVendorProduct(transport: AuthenticatedTransport, id: string): Promise<ProductDetail> {
  return transport.request(`/api/vendor-products/${encodeURIComponent(id)}`, productDetailSchema)
}

export function createVendorProduct(
  transport: AuthenticatedTransport,
  input: CreateProductInput,
): Promise<ProductDetail> {
  return transport.request('/api/vendor-products', productDetailSchema, {
    method: 'POST',
    body: createProductInputSchema.parse(input),
  })
}

export function updateVendorProduct(
  transport: AuthenticatedTransport,
  id: string,
  input: UpdateProductInput,
): Promise<ProductDetail> {
  return transport.request(
    `/api/vendor-products/${encodeURIComponent(id)}`,
    productDetailSchema,
    { method: 'PATCH', body: updateProductInputSchema.parse(input) },
  )
}

export async function deleteVendorProduct(
  transport: AuthenticatedTransport,
  id: string,
): Promise<void> {
  // DELETE returns 204 No Content; the response body is empty, so we parse
  // against a permissive schema and discard the result.
  await transport.request(
    `/api/vendor-products/${encodeURIComponent(id)}`,
    z.unknown(),
    { method: 'DELETE' },
  )
}
