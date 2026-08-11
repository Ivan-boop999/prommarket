import type { DbClient } from '../../db'
import { NotificationsService } from './application/notifications-service'
import { createNotificationsRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateNotificationsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
}

export function createNotificationsModule({ db, requireAuth }: CreateNotificationsModuleOptions) {
  const service = new NotificationsService(db)
  return {
    routes: createNotificationsRoutes({ requireAuth, service }),
    service,
  }
}

export { NotificationsService } from './application/notifications-service'
