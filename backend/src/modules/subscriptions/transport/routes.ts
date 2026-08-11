import {
  apiErrorSchema,
  confirmInvoiceInputSchema,
  createSubscriptionInputSchema,
  invoiceSchema,
  subscriptionPlanSchema,
  vendorSubscriptionSchema,
  type CreateSubscriptionInput,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeSubscriptions } from './errors'
import type { SubscriptionsService } from '../application/subscriptions-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const listPlansRoute = createRoute({
  method: 'get',
  path: '/plans',
  responses: {
    200: {
      description: 'Active subscription plans',
      content: { 'application/json': { schema: z.array(subscriptionPlanSchema) } },
    },
  },
})

const getCurrentSubscriptionRoute = createRoute({
  method: 'get',
  path: '/me',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Current subscription (may be null)',
      content: { 'application/json': { schema: vendorSubscriptionSchema.nullable() } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const subscribeRoute = createRoute({
  method: 'post',
  path: '/subscribe',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: createSubscriptionInputSchema } } },
  },
  responses: {
    201: {
      description: 'Pending subscription + issued invoice',
      content: {
        'application/json': {
          schema: z.object({ subscription: vendorSubscriptionSchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
    404: { content: errorContent, description: 'Plan not found' },
    409: { content: errorContent, description: 'Already pending / inactive plan' },
  },
})

const listInvoicesRoute = createRoute({
  method: 'get',
  path: '/invoices',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Vendor invoices',
      content: { 'application/json': { schema: z.array(invoiceSchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const confirmInvoiceParamsSchema = z.object({ invoiceId: z.uuid() }).strict()

const confirmInvoiceRoute = createRoute({
  method: 'post',
  path: '/invoices/{invoiceId}/confirm',
  security: bearerSecurity,
  request: {
    params: confirmInvoiceParamsSchema,
    body: { content: { 'application/json': { schema: confirmInvoiceInputSchema } } },
  },
  responses: {
    200: {
      description: 'Invoice confirmed, subscription activated',
      content: {
        'application/json': {
          schema: z.object({ invoice: invoiceSchema, subscription: vendorSubscriptionSchema }).strict(),
        },
      },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Already confirmed / not payable' },
  },
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type CreateSubscriptionsRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: SubscriptionsService
  /** Resolve the vendor id for the authenticated user, or null if not a vendor. */
  resolveVendorId: (userId: string) => Promise<string | null>
}

export function createSubscriptionsRoutes({
  requireAuth,
  requireVendor,
  requireAdmin,
  service,
  resolveVendorId,
}: CreateSubscriptionsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // Public: list plans (vendors browse tariffs before subscribing).
  routes.openapi(listPlansRoute, async (c) => {
    const plans = await service.listPlans()
    return c.json(plans, 200)
  })

  // Vendor: current subscription + invoices.
  const vendorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  vendorRoutes.use('*', requireAuth)
  vendorRoutes.use('*', requireVendor)

  vendorRoutes.openapi(getCurrentSubscriptionRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json(null, 200)
    const subscription = await service.getCurrentSubscription(vendorId)
    return c.json(subscription, 200)
  })

  vendorRoutes.openapi(subscribeRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found')
    }
    const input: CreateSubscriptionInput = c.req.valid('json')
    const result = await executeSubscriptions(() => service.subscribe(vendorId, input))
    return c.json(result, 201)
  })

  vendorRoutes.openapi(listInvoicesRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json([], 200)
    const invoices = await service.listInvoices(vendorId)
    return c.json(invoices, 200)
  })

  // Admin: confirm payment (manual, after bank transfer).
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth)
  adminRoutes.use('*', requireAdmin)

  adminRoutes.openapi(confirmInvoiceRoute, async (c) => {
    const { invoiceId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await executeSubscriptions(() =>
      service.confirmPayment({
        invoiceId,
        confirmerId: c.var.user.id,
        paymentReference: input.paymentReference,
      }),
    )
    return c.json(result, 200)
  })

  routes.route('/', vendorRoutes)
  routes.route('/', adminRoutes)
  return routes
}
