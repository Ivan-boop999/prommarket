import { useQuery } from '@tanstack/react-query'
import type { ProductsQuery } from '@web-app-demo/contracts'

import { getProduct, listCategories, listProducts, listVendors } from './api'

/**
 * Catalog query hooks.
 *
 * Query keys are rooted at `['catalog', ...]` rather than `['session', ...]`
 * because catalog endpoints are public and independent of the session cache.
 * `staleTime` is left at the global 30s default — catalog data changes rarely
 * enough that a user does not need fresh counts on every navigation.
 */
export const catalogQueryKeys = {
  all: ['catalog'] as const,
  categories: () => [...catalogQueryKeys.all, 'categories'] as const,
  products: (query: ProductsQuery) => [...catalogQueryKeys.all, 'products', query] as const,
  product: (id: string) => [...catalogQueryKeys.all, 'product', id] as const,
  vendors: () => [...catalogQueryKeys.all, 'vendors'] as const,
}

export function useCatalogCategoriesQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.categories(),
    queryFn: listCategories,
  })
}

export function useCatalogProductsQuery(query: ProductsQuery) {
  return useQuery({
    queryKey: catalogQueryKeys.products(query),
    queryFn: () => listProducts(query),
  })
}

export function useProductDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: catalogQueryKeys.product(id ?? ''),
    queryFn: () => getProduct(id!),
    enabled: Boolean(id),
  })
}

export function useCatalogVendorsQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.vendors(),
    queryFn: listVendors,
  })
}
