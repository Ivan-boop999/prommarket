import type {
  Category,
  FlatCategory,
  ProductDetail,
  ProductListItem,
  ProductsQuery,
  SearchResult,
  VendorSummary,
} from '@web-app-demo/contracts'

import { CatalogFailure } from '../domain/errors'
import type { CategoryReader, Clock, ProductReader, VendorReader } from './ports'

/**
 * Catalog application service.
 *
 * Thin orchestration over the reader ports: most logic lives in the Prisma
 * repositories (filter building, view counting, DTO mapping). The service is
 * where cross-repository composition or domain failure decisions belong; for
 * plain listing there is nothing to compose, so methods are near-passthrough.
 *
 * `getProduct` is the one place a domain failure is raised: a missing product
 * becomes `CatalogFailure('not_found')`, which `transport/errors.ts` maps to
 * a 404. `findByIdAndBumpViews` does the view increment atomically on the
 * server, fixing the original race where a separate UPDATE could lose counts.
 */
export type CatalogServiceDependencies = {
  categoryReader: CategoryReader
  clock: Clock
  productReader: ProductReader
  vendorReader: VendorReader
}

export class CatalogService {
  constructor(private readonly dependencies: CatalogServiceDependencies) {}

  categoryTree(): Promise<Category[]> {
    return this.dependencies.categoryReader.tree()
  }

  flatCategories(): Promise<FlatCategory[]> {
    return this.dependencies.categoryReader.flat()
  }

  /** Category id plus all descendant ids, for rollup filtering. */
  categoryDescendants(rootId: string): Promise<Set<string>> {
    return this.dependencies.categoryReader.descendantIds(rootId)
  }

  listProducts(query: ProductsQuery): Promise<{
    items: ProductListItem[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }> {
    return this.dependencies.productReader.list(query)
  }

  async getProduct(id: string): Promise<ProductDetail> {
    const product = await this.dependencies.productReader.findByIdAndBumpViews(id)
    if (!product) {
      throw new CatalogFailure('not_found', `Product ${id} not found`)
    }
    return product
  }

  search(input: {
    query: string
    categoryId?: string
    page: number
    pageSize: number
  }): Promise<SearchResult> {
    return this.dependencies.productReader.search(input)
  }

  listVendors(): Promise<VendorSummary[]> {
    return this.dependencies.vendorReader.list()
  }
}

export type { Category, FlatCategory, ProductDetail, ProductListItem, ProductsQuery, SearchResult, VendorSummary } from '@web-app-demo/contracts'
