import type { DbClient } from '../../db'
import { VendorProductsService } from './application/vendor-products-service'
import { createPrismaVendorProductsRepository } from './infrastructure/vendor-products-repository'
import { createVendorProductsRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateVendorProductsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
}

export function createVendorProductsModule({
  db,
  requireAuth,
  requireVendor,
}: CreateVendorProductsModuleOptions) {
  const repository = createPrismaVendorProductsRepository(db)
  const service = new VendorProductsService(repository)

  const resolveVendorId = async (userId: string): Promise<string | null> => {
    const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
    return vendor?.id ?? null
  }

  return {
    routes: createVendorProductsRoutes({ requireAuth, requireVendor, service, resolveVendorId }),
    service,
  }
}

export { VendorProductsService } from './application/vendor-products-service'
