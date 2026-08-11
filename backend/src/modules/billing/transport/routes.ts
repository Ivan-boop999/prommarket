import {
  activateAddOnInputSchema,
  apiErrorSchema,
  createFeaturedPlacementInputSchema,
  featuredPlacementSchema,
  invoiceSchema,
  invoicesQuerySchema,
  vendorAddOnSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv, MiddlewareHandler } from '../../auth'
import { executeBilling } from './errors'
import type { BillingService } from '../application/billing-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const invoiceIdParamsSchema = z.object({ invoiceId: z.uuid() }).strict()
const paymentRefBodySchema = z
  .object({ paymentReference: z.string().trim().max(200).optional() })
  .strict()

const listInvoicesRoute = createRoute({
  method: 'get',
  path: '/invoices',
  security: bearerSecurity,
  request: { query: invoicesQuerySchema },
  responses: {
    200: {
      description: 'Invoices',
      content: { 'application/json': { schema: z.array(invoiceSchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const createFeaturedRoute = createRoute({
  method: 'post',
  path: '/featured',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createFeaturedPlacementInputSchema } } } },
  responses: {
    201: {
      description: 'Pending featured placement + issued invoice',
      content: {
        'application/json': {
          schema: z.object({ placement: featuredPlacementSchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required / not owner' },
  },
})

const confirmFeaturedRoute = createRoute({
  method: 'post',
  path: '/featured/{invoiceId}/confirm',
  security: bearerSecurity,
  request: { params: invoiceIdParamsSchema, body: { content: { 'application/json': { schema: paymentRefBodySchema } } } },
  responses: {
    200: {
      description: 'Featured placement activated',
      content: {
        'application/json': {
          schema: z.object({ placement: featuredPlacementSchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Already confirmed / not payable' },
  },
})

const activateAddOnRoute = createRoute({
  method: 'post',
  path: '/add-ons',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: activateAddOnInputSchema } } } },
  responses: {
    201: {
      description: 'Pending add-on + issued invoice',
      content: {
        'application/json': {
          schema: z.object({ addOn: vendorAddOnSchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
  },
})

const confirmAddOnRoute = createRoute({
  method: 'post',
  path: '/add-ons/{invoiceId}/confirm',
  security: bearerSecurity,
  request: { params: invoiceIdParamsSchema, body: { content: { 'application/json': { schema: paymentRefBodySchema } } } },
  responses: {
    200: {
      description: 'Add-on activated',
      content: {
        'application/json': {
          schema: z.object({ addOn: vendorAddOnSchema, invoice: invoiceSchema }).strict(),
        },
      },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Already confirmed / not payable' },
  },
})

type CreateBillingRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: BillingService
  resolveVendorId: (userId: string) => Promise<string | null>
}

export function createBillingRoutes({
  requireAuth,
  requireVendor,
  requireAdmin,
  service,
  resolveVendorId,
}: CreateBillingRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // Vendor: list own invoices, buy featured, buy add-on.
  const vendorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  vendorRoutes.use('*', requireAuth)
  vendorRoutes.use('*', requireVendor)

  vendorRoutes.openapi(listInvoicesRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    const query = c.req.valid('query')
    const invoices = await service.listInvoices({
      vendorId: vendorId ?? undefined,
      status: query.status,
      type: query.type,
    })
    return c.json(invoices, 200)
  })

  vendorRoutes.openapi(createFeaturedRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor profile not found' } }, 404)
    }
    const input = c.req.valid('json')
    const result = await executeBilling(() => service.createFeaturedPlacement(vendorId, input))
    return c.json(result, 201)
  })

  vendorRoutes.openapi(activateAddOnRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor profile not found' } }, 404)
    }
    const input = c.req.valid('json')
    const result = await executeBilling(() => service.activateAddOn(vendorId, input))
    return c.json(result, 201)
  })

  // Admin: confirm featured / add-on.
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth)
  adminRoutes.use('*', requireAdmin)

  adminRoutes.openapi(confirmFeaturedRoute, async (c) => {
    const { invoiceId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await executeBilling(() =>
      service.confirmFeatured({
        invoiceId,
        confirmerId: c.var.user.id,
        paymentReference: input.paymentReference,
      }),
    )
    return c.json(result, 200)
  })

  adminRoutes.openapi(confirmAddOnRoute, async (c) => {
    const { invoiceId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await executeBilling(() =>
      service.confirmAddOn({
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
