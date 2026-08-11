import {
  paginatedResponseSchema,
  productDetailSchema,
  productListItemSchema,
  productsQuerySchema,
  searchQuerySchema,
  searchResultSchema,
  vendorSummarySchema,
  categorySchema,
  productReviewSchema,
  createReviewInputSchema,
  type Category,
  type CreateReviewInput,
  type ProductDetail,
  type ProductListItem,
  type ProductReview,
  type ProductsQuery,
  type SearchQuery,
  type SearchResult,
  type VendorSummary,
} from '@web-app-demo/contracts'
import { z } from 'zod'

import { publicClient } from '@/platform/api/public-client'
import type { AuthenticatedTransport } from '@/platform/api'

/**
 * Catalog API. All endpoints are public (no session required), so they go
 * through the shared `publicClient` rather than `useAuth().transport`.
 *
 * Query parameters are serialized here with explicit `URLSearchParams` because
 * the products filter has arrays (status, availability) and nested attribute
 * filters that the contracts expect in a specific shape.
 */

export function listCategories(): Promise<Category[]> {
  return publicClient.request('/api/catalog/categories', z.array(categorySchema))
}

export function listProducts(
  query: ProductsQuery,
): Promise<{
  items: ProductListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}> {
  const validated = productsQuerySchema.parse(query)
  const search = productsQueryToSearchParams(validated)
  return publicClient.request(
    `/api/catalog/products?${search}`,
    paginatedResponseSchema(productListItemSchema),
  )
}

export function getProduct(id: string): Promise<ProductDetail> {
  return publicClient.request(`/api/catalog/products/${encodeURIComponent(id)}`, productDetailSchema)
}

export function listVendors(): Promise<VendorSummary[]> {
  return publicClient.request('/api/catalog/vendors', z.array(vendorSummarySchema))
}

export function searchCatalog(query: SearchQuery): Promise<SearchResult> {
  const validated = searchQuerySchema.parse(query)
  const search = new URLSearchParams({
    query: validated.query,
    page: String(validated.page),
    pageSize: String(validated.pageSize),
  })
  if (validated.categoryId) search.set('categoryId', validated.categoryId)
  return publicClient.request(`/api/catalog/search?${search}`, searchResultSchema)
}

/**
 * Serialize a validated ProductsQuery into URLSearchParams.
 * Arrays (status, availability) repeat the key; attribute filters expand into
 * `attributes[slug]=value` entries to match the contract's record shape.
 */
export function productsQueryToSearchParams(query: ProductsQuery): URLSearchParams {
  const search = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  })
  if (query.categoryId) search.set('categoryId', query.categoryId)
  if (query.vendorId) search.set('vendorId', query.vendorId)
  if (query.search) search.set('search', query.search)
  if (query.priceMin !== undefined) search.set('priceMin', String(query.priceMin))
  if (query.priceMax !== undefined) search.set('priceMax', String(query.priceMax))
  for (const status of query.status ?? []) search.append('status', status)
  for (const availability of query.availability ?? []) search.append('availability', availability)
  if (query.attributes) {
    for (const [slug, values] of Object.entries(query.attributes)) {
      for (const value of values) search.append(`attributes[${slug}]`, value)
    }
  }
  return search
}

// --- Reviews (public read, authenticated write) ---

export function listProductReviews(productId: string): Promise<ProductReview[]> {
  return publicClient.request(
    `/api/reviews/products/${encodeURIComponent(productId)}/reviews`,
    z.array(productReviewSchema),
  )
}

export function createReview(
  transport: AuthenticatedTransport,
  productId: string,
  input: CreateReviewInput,
): Promise<ProductReview> {
  return transport.request(
    `/api/reviews/products/${encodeURIComponent(productId)}/reviews`,
    productReviewSchema,
    { method: 'POST', body: createReviewInputSchema.parse(input) },
  )
}
