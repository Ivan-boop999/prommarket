import {
  apiErrorSchema,
  brokerFeeLedgerEntrySchema,
  brokerFeeStatsSchema,
  brokerFeesQuerySchema,
  invoiceSchema,
  paginatedResponseSchema,
} from '@prommarket/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeBroker } from './errors'
import type { BrokerService } from '../application/broker-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const feeIdParamsSchema = z.object({ feeId: z.uuid() }).strict()
const paymentRefBodySchema = z
  .object({ paymentReference: z.string().trim().max(200).optional() })
  .strict()

const listFeesRoute = createRoute({
  method: 'get',
  path: '/fees',
  security: bearerSecurity,
  request: { query: brokerFeesQuerySchema },
  responses: {
    200: {
      description: 'Broker fees (paginated)',
      content: { 'application/json': { schema: paginatedResponseSchema(brokerFeeLedgerEntrySchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Broker access required' },
  },
})

const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Broker fee aggregates',
      content: { 'application/json': { schema: brokerFeeStatsSchema } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Broker access required' },
  },
})

const invoiceFeeRoute = createRoute({
  method: 'post',
  path: '/fees/{feeId}/invoice',
  security: bearerSecurity,
  request: { params: feeIdParamsSchema },
  responses: {
    200: {
      description: 'Fee invoiced',
      content: {
        'application/json': {
          schema: z.object({ fee: brokerFeeLedgerEntrySchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Fee not found' },
    409: { content: errorContent, description: 'Not payable' },
  },
})

const confirmFeePaymentRoute = createRoute({
  method: 'post',
  path: '/fees/{feeId}/confirm-payment',
  security: bearerSecurity,
  request: { params: feeIdParamsSchema, body: { content: { 'application/json': { schema: paymentRefBodySchema } } } },
  responses: {
    200: {
      description: 'Fee payment confirmed',
      content: {
        'application/json': {
          schema: z.object({ fee: brokerFeeLedgerEntrySchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Fee not found' },
    409: { content: errorContent, description: 'Already confirmed / not payable' },
  },
})

type CreateBrokerRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireBroker: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: BrokerService
}

export function createBrokerRoutes({
  requireAuth,
  requireBroker,
  requireAdmin,
  service,
}: CreateBrokerRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // Broker: list own fees + stats.
  const brokerRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  brokerRoutes.use('*', requireAuth)
  brokerRoutes.use('*', requireBroker)

  brokerRoutes.openapi(listFeesRoute, async (c) => {
    const query = c.req.valid('query')
    const result = await service.listFees(c.var.user.id, query)
    return c.json(
      {
        items: result.items,
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      },
      200,
    )
  })

  brokerRoutes.openapi(statsRoute, async (c) => {
    const stats = await service.stats(c.var.user.id)
    return c.json(stats, 200)
  })

  // Admin: invoice a fee + confirm payment.
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth)
  adminRoutes.use('*', requireAdmin)

  adminRoutes.openapi(invoiceFeeRoute, async (c) => {
    const { feeId } = c.req.valid('param')
    const result = await executeBroker(() => service.invoiceFee(feeId))
    return c.json(result, 200)
  })

  adminRoutes.openapi(confirmFeePaymentRoute, async (c) => {
    const { feeId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await executeBroker(() =>
      service.confirmFeePayment({ feeId, confirmerId: c.var.user.id, paymentReference: input.paymentReference }),
    )
    return c.json(result, 200)
  })

  routes.route('/', brokerRoutes)
  routes.route('/', adminRoutes)
  return routes
}
