import type { DbClient } from '../../db'
import { DealsService } from './application/deals-service'
import { createPrismaDealsRepository } from './infrastructure/deals-repository'
import { createDealsRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateDealsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
}

export function createDealsModule({ db, requireAuth }: CreateDealsModuleOptions) {
  const repository = createPrismaDealsRepository(db)
  const service = new DealsService({ clock: { now: () => new Date() }, repository })

  // Resolve the role-specific profile id for the /me deals scope.
  const resolveProfileId = async (userId: string, role: string): Promise<string | null> => {
    if (role === 'buyer') {
      const buyer = await db.buyer.findUnique({ where: { userId }, select: { id: true } })
      return buyer?.id ?? null
    }
    if (role === 'vendor') {
      const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
      return vendor?.id ?? null
    }
    if (role === 'broker') {
      // Broker is just a User; the deal's brokerId references users.id directly.
      return userId
    }
    return null
  }

  return {
    routes: createDealsRoutes({ requireAuth, service, resolveProfileId }),
    service,
  }
}

export { DealsService } from './application/deals-service'
