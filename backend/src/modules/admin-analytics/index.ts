import type { DbClient } from '../../db'
import { AdminAnalyticsService } from './application/admin-analytics-service'
import { createAdminAnalyticsRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateAdminAnalyticsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createAdminAnalyticsModule({
  db,
  requireAuth,
  requireAdmin,
}: CreateAdminAnalyticsModuleOptions) {
  const service = new AdminAnalyticsService(db)
  return {
    routes: createAdminAnalyticsRoutes({ requireAuth, requireAdmin, service }),
    service,
  }
}

export { AdminAnalyticsService } from './application/admin-analytics-service'
