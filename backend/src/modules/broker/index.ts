import type { DbClient } from '../../db'
import { BrokerService } from './application/broker-service'
import { createPrismaBrokerRepository } from './infrastructure/broker-repository'
import { createBrokerRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateBrokerModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireBroker: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createBrokerModule({ db, requireAuth, requireBroker, requireAdmin }: CreateBrokerModuleOptions) {
  const repository = createPrismaBrokerRepository(db)
  const service = new BrokerService({ clock: { now: () => new Date() }, repository })

  return {
    routes: createBrokerRoutes({ requireAuth, requireBroker, requireAdmin, service }),
    service,
  }
}

export { BrokerService } from './application/broker-service'
