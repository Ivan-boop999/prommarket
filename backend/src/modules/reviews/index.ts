import type { DbClient } from '../../db'
import { ReviewsService } from './application/reviews-service'
import { createReviewsRoutes } from './transport/routes'
import type { MiddlewareHandler } from '../../modules/auth'

type CreateReviewsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireBuyer: MiddlewareHandler
  requireVendor: MiddlewareHandler
}

export function createReviewsModule({
  db,
  requireAuth,
  requireBuyer,
  requireVendor,
}: CreateReviewsModuleOptions) {
  const service = new ReviewsService(db)
  return {
    routes: createReviewsRoutes({ requireAuth, requireBuyer, requireVendor, service }),
    service,
  }
}

export { ReviewsService } from './application/reviews-service'
