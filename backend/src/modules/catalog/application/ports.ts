import type {
  Category,
  FlatCategory,
  ProductDetail,
  ProductListItem,
  ProductsQuery,
  SearchResult,
  VendorSummary,
} from '@prommarket/contracts'

/**
 * Catalog application ports.
 *
 * Reader ports return contract DTOs directly (mirrors the `users` module): the
 * Prisma repository maps rows to `Category` / `ProductListItem` / etc. so the
 * service and transport layers never see raw DB rows. There are no write ports
 * here yet; vendor product writes land in a later iteration under a separate
 * module.
 */

export type CategoryReader = {
  /** Nested category tree, children sorted by `order`. */
  tree(): Promise<Category[]>
  /** Flat list of categories, useful for select inputs and filter facets. */
  flat(): Promise<FlatCategory[]>
  /**
   * The set of category ids to match when filtering by a parent: the parent
   * itself plus all descendant ids. The products repository uses this to make
   * `categoryId` roll up subcategories server-side (the original client-side
   * `collectCategoryIds` logic, now done once on the server).
   */
  descendantIds(rootId: string): Promise<Set<string>>
}

export type ProductReader = {
  list(query: ProductsQuery): Promise<{
    items: ProductListItem[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }>
  /** Full product detail, or null when missing. Does NOT bump view count. */
  findById(id: string): Promise<ProductDetail | null>
  /**
   * Atomically bumps `views` and returns the detail. Used by the public
   * product page so each visit is counted exactly once even under concurrency.
   */
  findByIdAndBumpViews(id: string): Promise<ProductDetail | null>
  search(input: {
    query: string
    categoryId?: string
    page: number
    pageSize: number
  }): Promise<SearchResult>
}

export type VendorReader = {
  list(): Promise<VendorSummary[]>
}

export type CatalogRepository = CategoryReader & ProductReader & VendorReader

export type Clock = { now(): Date }
