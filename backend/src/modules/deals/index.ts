import type { DbClient } from '../../db'
import { DealsService } from './application/deals-service'
import { createPrismaDealsRepository } from './infrastructure/deals-repository'
import { createDealsRoutes } from './transport/routes'
import type { MiddlewareHandler } from '../../modules/auth'

type CreateDealsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
}

export function createDealsModule({ db, requireAuth }: CreateDealsModuleOptions) {
  const repository = createPrismaDealsRepository(db)
  const service = new DealsService({ clock: { now: () => new Date() }, repository })
  return {
    routes: createDealsRoutes({ requireAuth, service }),
    service,
  }
}

export { DealsService } from './application/deals-service'
