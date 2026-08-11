import type { DbClient } from '../../db'
import { CatalogService } from './application/catalog-service'
import { createPrismaCategoriesRepository } from './infrastructure/categories-repository'
import { createPrismaProductsRepository } from './infrastructure/products-repository'
import { createPrismaVendorsRepository } from './infrastructure/vendors-repository'
import { createCatalogRoutes } from './transport/routes'

/**
 * Catalog module factory.
 *
 * Public read endpoints for the marketplace: categories tree, product list with
 * server-side filtering (EAV, price, category rollup), product detail, vendors,
 * and unified search. No `requireAuth`/`requireAdmin` dependency here — the
 * catalog is browseable without an account. Vendor write endpoints will be a
 * separate module that depends on those guards.
 */
type CreateCatalogModuleOptions = {
  db: DbClient
}

export function createCatalogModule(options: CreateCatalogModuleOptions) {
  const categoryReader = createPrismaCategoriesRepository(options.db)
  const productReader = createPrismaProductsRepository(options.db)
  const vendorReader = createPrismaVendorsRepository(options.db)

  const service = new CatalogService({
    categoryReader,
    clock: { now: () => new Date() },
    productReader,
    vendorReader,
  })

  return {
    routes: createCatalogRoutes({ service }),
    service,
  }
}

export { CatalogService } from './application/catalog-service'
export type { CatalogRepository } from './application/ports'
