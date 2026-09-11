import {
  apiErrorSchema,
  changeDealStatusInputSchema,
  createDealInputSchema,
  createDealMessageInputSchema,
  dealDetailSchema,
  dealListItemSchema,
  dealMessageSchema,
  dealsQuerySchema,
  paginatedResponseSchema,
  type ChangeDealStatusInput,
  type CreateDealInput,
  type CreateDealMessageInput,
  type DealsQuery,
} from '@prommarket/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeDeals } from './errors'
import type { DealsService } from '../application/deals-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]
const idParamsSchema = z.object({ id: z.uuid() }).strict()

const listDealsRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  request: { query: dealsQuerySchema },
  responses: {
    200: {
      description: 'Paginated deals',
      content: { 'application/json': { schema: paginatedResponseSchema(dealListItemSchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const getDealRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    200: {
      description: 'Deal detail',
      content: { 'application/json': { schema: dealDetailSchema } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    404: { content: errorContent, description: 'Deal not found' },
  },
})

/**
 * Deals for the authenticated user, scoped by role:
 *  - buyer  → deals where they are the buyer
 *  - broker → deals where they are the broker
 *  - vendor → deals on their products (resolved via vendor profile)
 *  - admin  → all deals (same as the generic list)
 */
const listMyDealsRoute = createRoute({
  method: 'get',
  path: '/me',
  security: bearerSecurity,
  request: { query: dealsQuerySchema },
  responses: {
    200: {
      description: 'Deals for the current user',
      content: { 'application/json': { schema: paginatedResponseSchema(dealListItemSchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const createDealRoute = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createDealInputSchema } } } },
  responses: {
    201: {
      description: 'Deal created',
      content: { 'application/json': { schema: dealDetailSchema } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Buyer access required' },
  },
})

const changeStatusRoute = createRoute({
  method: 'patch',
  path: '/{id}/status',
  security: bearerSecurity,
  request: {
    params: idParamsSchema,
    body: { content: { 'application/json': { schema: changeDealStatusInputSchema } } },
  },
  responses: {
    200: {
      description: 'Status changed',
      content: { 'application/json': { schema: dealDetailSchema } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    404: { content: errorContent, description: 'Deal not found' },
    409: { content: errorContent, description: 'Invalid transition' },
  },
})

const createMessageRoute = createRoute({
  method: 'post',
  path: '/{id}/messages',
  security: bearerSecurity,
  request: {
    params: idParamsSchema,
    body: { content: { 'application/json': { schema: createDealMessageInputSchema } } },
  },
  responses: {
    201: {
      description: 'Message added',
      content: { 'application/json': { schema: dealMessageSchema } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    404: { content: errorContent, description: 'Deal not found' },
  },
})

type CreateDealsRoutesOptions = {
  requireAuth: MiddlewareHandler
  service: DealsService
  /** Resolve buyer/vendor/broker profile id from a user id, for the /me scope. */
  resolveProfileId: (userId: string, role: string) => Promise<string | null>
}

export function createDealsRoutes({ requireAuth, service, resolveProfileId }: CreateDealsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)

  routes.openapi(listDealsRoute, async (c) => {
    const query: DealsQuery = c.req.valid('query')
    const result = await service.list(query)
    return c.json(result, 200)
  })

  routes.openapi(listMyDealsRoute, async (c) => {
    const query: DealsQuery = c.req.valid('query')
    const role = c.var.user.role
    const userId = c.var.user.id
    // Admin sees everything; others are scoped to their profile.
    if (role === 'admin') {
      const result = await service.list(query)
      return c.json(result, 200)
    }
    const profileId = await resolveProfileId(userId, role)
    if (!profileId) {
      return c.json({ items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 }, 200)
    }
    const scopedQuery: DealsQuery = {
      ...query,
      ...(role === 'buyer' ? { buyerId: profileId } : {}),
      ...(role === 'broker' ? { brokerId: profileId } : {}),
      ...(role === 'vendor' ? { vendorId: profileId } : {}),
    }
    const result = await service.list(scopedQuery)
    return c.json(result, 200)
  })

  routes.openapi(getDealRoute, async (c) => {
    const { id } = c.req.valid('param')
    const deal = await executeDeals(() => service.getDetail(id))
    if (!deal) throw new AppError(404, 'NOT_FOUND', 'Deal not found')
    return c.json(deal, 200)
  })

  routes.openapi(createDealRoute, async (c) => {
    const input: CreateDealInput = c.req.valid('json')
    const deal = await executeDeals(() => service.create(c.var.user.id, input))
    return c.json(deal, 201)
  })

  routes.openapi(changeStatusRoute, async (c) => {
    const { id } = c.req.valid('param')
    const input: ChangeDealStatusInput = c.req.valid('json')
    const deal = await executeDeals(() => service.changeStatus(id, c.var.user.id, input))
    return c.json(deal, 200)
  })

  routes.openapi(createMessageRoute, async (c) => {
    const { id } = c.req.valid('param')
    const input: CreateDealMessageInput = c.req.valid('json')
    // senderRole derived from the authenticated user's role.
    const role = c.var.user.role
    const senderRole = role === 'broker' ? 'broker' : role === 'vendor' ? 'vendor' : 'buyer'
    const message = await executeDeals(() =>
      service.addMessage(id, c.var.user.id, senderRole, input),
    )
    return c.json(message, 201)
  })

  return routes
}
