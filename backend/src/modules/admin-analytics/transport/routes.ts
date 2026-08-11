import { apiErrorSchema } from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv, MiddlewareHandler } from '../../auth'
import type { AdminAnalyticsService } from '../application/admin-analytics-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const analyticsSchema = z
  .object({
    dealsByStatus: z.array(z.object({ status: z.string(), count: z.number().int() }).strict()),
    dealsByType: z.array(z.object({ type: z.string(), count: z.number().int() }).strict()),
    topCategories: z.array(
      z.object({ categoryId: z.string(), categoryName: z.string(), productCount: z.number().int() }).strict(),
    ),
    avgDealValue: z.string(),
    totalDeals: z.number().int(),
    totalProducts: z.number().int(),
    totalVendors: z.number().int(),
    totalBuyers: z.number().int(),
    activeSubscriptions: z.number().int(),
    subscriptionMrr: z.string(),
    commissionsAccrued: z.string(),
    commissionsPaid: z.string(),
  })
  .strict()

const analyticsRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  responses: {
    200: { description: 'Admin analytics aggregates', content: { 'application/json': { schema: analyticsSchema } } },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
  },
})

type CreateAdminAnalyticsRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: AdminAnalyticsService
}

export function createAdminAnalyticsRoutes({
  requireAuth,
  requireAdmin,
  service,
}: CreateAdminAnalyticsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)
  routes.use('*', requireAdmin)

  routes.openapi(analyticsRoute, async (c) => {
    const analytics = await service.getAnalytics()
    return c.json(analytics, 200)
  })

  return routes
}
