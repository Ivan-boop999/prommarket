import type { DbClient } from '../../db'
import { AdminCatalogService } from './application/admin-catalog-service'
import { createAdminCatalogRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateAdminCatalogModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createAdminCatalogModule({
  db,
  requireAuth,
  requireAdmin,
}: CreateAdminCatalogModuleOptions) {
  const service = new AdminCatalogService(db)
  return {
    routes: createAdminCatalogRoutes({ requireAuth, requireAdmin, service }),
    service,
  }
}

export { AdminCatalogService } from './application/admin-catalog-service'
