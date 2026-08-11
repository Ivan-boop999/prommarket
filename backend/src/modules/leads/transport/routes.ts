import {
  apiErrorSchema,
  leadCreditBalanceSchema,
  leadCreditLedgerEntrySchema,
  leadCreditPriceSchema,
  purchaseLeadCreditsInputSchema,
  unlockLeadInputSchema,
  invoiceSchema,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeLeads } from './errors'
import type { LeadsService } from '../application/leads-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const getPriceRoute = createRoute({
  method: 'get',
  path: '/price',
  responses: {
    200: {
      description: 'Per-credit price and volume tiers',
      content: { 'application/json': { schema: leadCreditPriceSchema } },
    },
  },
})

const getBalanceRoute = createRoute({
  method: 'get',
  path: '/balance',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Current credit balance',
      content: { 'application/json': { schema: leadCreditBalanceSchema } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const getLedgerRoute = createRoute({
  method: 'get',
  path: '/ledger',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Credit ledger history',
      content: { 'application/json': { schema: z.array(leadCreditLedgerEntrySchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const purchaseRoute = createRoute({
  method: 'post',
  path: '/purchase',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: purchaseLeadCreditsInputSchema } } },
  },
  responses: {
    201: {
      description: 'Issued invoice for credit purchase',
      content: { 'application/json': { schema: z.object({ invoice: invoiceSchema }).strict() } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
  },
})

const unlockRoute = createRoute({
  method: 'post',
  path: '/unlock',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: unlockLeadInputSchema } } },
  },
  responses: {
    200: {
      description: 'Lead unlocked; returns the ledger entry and new balance',
      content: {
        'application/json': {
          schema: z
            .object({ ledgerEntry: leadCreditLedgerEntrySchema, balance: z.number().int() })
            .strict(),
        },
      },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    402: { content: errorContent, description: 'Insufficient credits' },
    409: { content: errorContent, description: 'Already unlocked' },
  },
})

const confirmPurchaseParamsSchema = z.object({ invoiceId: z.uuid() }).strict()
const confirmPurchaseBodySchema = z
  .object({ paymentReference: z.string().trim().max(200).optional() })
  .strict()

const confirmPurchaseRoute = createRoute({
  method: 'post',
  path: '/purchase/{invoiceId}/confirm',
  security: bearerSecurity,
  request: {
    params: confirmPurchaseParamsSchema,
    body: { content: { 'application/json': { schema: confirmPurchaseBodySchema } } },
  },
  responses: {
    200: {
      description: 'Purchase confirmed, credits granted',
      content: {
        'application/json': {
          schema: z.object({ invoice: invoiceSchema, balance: z.number().int() }).strict(),
        },
      },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Invoice not found' },
    409: { content: errorContent, description: 'Already confirmed / not payable' },
  },
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type CreateLeadsRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: LeadsService
  resolveVendorId: (userId: string) => Promise<string | null>
}

export function createLeadsRoutes({
  requireAuth,
  requireVendor,
  requireAdmin,
  service,
  resolveVendorId,
}: CreateLeadsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // Public: price.
  routes.openapi(getPriceRoute, async (c) => c.json(service.getPrice(), 200))

  // Vendor: balance / ledger / purchase / unlock.
  const vendorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  vendorRoutes.use('*', requireAuth)
  vendorRoutes.use('*', requireVendor)

  vendorRoutes.openapi(getBalanceRoute, async (c) => {
    const vendorId = (await resolveVendorId(c.var.user.id)) ?? ''
    const balance = await service.balance(vendorId)
    return c.json(balance, 200)
  })

  vendorRoutes.openapi(getLedgerRoute, async (c) => {
    const vendorId = (await resolveVendorId(c.var.user.id)) ?? ''
    const ledger = await service.ledger(vendorId)
    return c.json(ledger, 200)
  })

  vendorRoutes.openapi(purchaseRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found')
    }
    const input = c.req.valid('json')
    const result = await executeLeads(() => service.purchase(vendorId, input))
    return c.json(result, 201)
  })

  vendorRoutes.openapi(unlockRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found')
    }
    const input = c.req.valid('json')
    const result = await executeLeads(() => service.unlock(vendorId, input.referenceId))
    return c.json(result, 200)
  })

  // Admin: confirm purchase.
  const adminRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  adminRoutes.use('*', requireAuth)
  adminRoutes.use('*', requireAdmin)

  adminRoutes.openapi(confirmPurchaseRoute, async (c) => {
    const { invoiceId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await executeLeads(() =>
      service.confirmPurchase({
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
