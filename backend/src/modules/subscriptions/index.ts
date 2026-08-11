import type { DbClient } from '../../db'
import { SubscriptionsService } from './application/subscriptions-service'
import { createPrismaSubscriptionsRepository } from './infrastructure/subscriptions-repository'
import { createSubscriptionsRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateSubscriptionsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createSubscriptionsModule({
  db,
  requireAuth,
  requireVendor,
  requireAdmin,
}: CreateSubscriptionsModuleOptions) {
  const repository = createPrismaSubscriptionsRepository(db)
  const service = new SubscriptionsService({
    clock: { now: () => new Date() },
    repository,
  })

  const resolveVendorId = async (userId: string): Promise<string | null> => {
    const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
    return vendor?.id ?? null
  }

  return {
    routes: createSubscriptionsRoutes({ requireAuth, requireVendor, requireAdmin, service, resolveVendorId }),
    service,
  }
}

export { SubscriptionsService } from './application/subscriptions-service'
