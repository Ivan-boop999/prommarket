import {
  apiErrorSchema,
  createVerificationRequestInputSchema,
  reviewVerificationInputSchema,
  verificationRequestSchema,
  type CreateVerificationRequestInput,
  type ReviewVerificationInput,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { AppError, validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeVerification } from './errors'
import type { VerificationService } from '../application/verification-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const idParamsSchema = z.object({ id: z.uuid() }).strict()

const createRequestRoute = createRoute({
  method: 'post',
  path: '/requests',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createVerificationRequestInputSchema } } } },
  responses: {
    201: {
      description: 'Verification request created (draft)',
      content: { 'application/json': { schema: verificationRequestSchema } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
  },
})

const submitRequestRoute = createRoute({
  method: 'post',
  path: '/requests/{id}/submit',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    200: {
      description: 'Request submitted for review',
      content: { 'application/json': { schema: verificationRequestSchema } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
    404: { content: errorContent, description: 'Request not found' },
    409: { content: errorContent, description: 'Not submittable' },
  },
})

const getRequestRoute = createRoute({
  method: 'get',
  path: '/requests/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    200: {
      description: 'Verification request detail',
      content: { 'application/json': { schema: verificationRequestSchema } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    404: { content: errorContent, description: 'Request not found' },
  },
})

const getMyLatestRoute = createRoute({
  method: 'get',
  path: '/me',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Latest verification request (may be null)',
      content: { 'application/json': { schema: verificationRequestSchema.nullable() } },
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const listPendingRoute = createRoute({
  method: 'get',
  path: '/pending',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Pending verification requests',
      content: { 'application/json': { schema: z.array(verificationRequestSchema) } },
    },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Moderator access required' },
  },
})

const reviewRoute = createRoute({
  method: 'post',
  path: '/requests/{id}/review',
  security: bearerSecurity,
  request: {
    params: idParamsSchema,
    body: { content: { 'application/json': { schema: reviewVerificationInputSchema } } },
  },
  responses: {
    200: {
      description: 'Request reviewed',
      content: { 'application/json': { schema: verificationRequestSchema } },
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Moderator access required' },
    404: { content: errorContent, description: 'Request not found' },
    409: { content: errorContent, description: 'Not reviewable' },
  },
})

type CreateVerificationRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireModerator: MiddlewareHandler
  service: VerificationService
  resolveVendorId: (userId: string) => Promise<string | null>
}

export function createVerificationRoutes({
  requireAuth,
  requireVendor,
  requireModerator,
  service,
  resolveVendorId,
}: CreateVerificationRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  const vendorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  vendorRoutes.use('*', requireAuth)
  vendorRoutes.use('*', requireVendor)

  vendorRoutes.openapi(createRequestRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) {
      throw new AppError(404, 'NOT_FOUND', 'Vendor profile not found')
    }
    const input: CreateVerificationRequestInput = c.req.valid('json')
    const result = await executeVerification(() => service.createRequest(vendorId, input))
    return c.json(result, 201)
  })

  vendorRoutes.openapi(submitRequestRoute, async (c) => {
    const { id } = c.req.valid('param')
    const result = await executeVerification(() => service.submit(id))
    return c.json(result, 200)
  })

  vendorRoutes.openapi(getRequestRoute, async (c) => {
    const { id } = c.req.valid('param')
    const result = await executeVerification(() => service.getById(id))
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Not found')
    return c.json(result, 200)
  })

  vendorRoutes.openapi(getMyLatestRoute, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json(null, 200)
    const result = await service.getLatestByVendor(vendorId)
    return c.json(result, 200)
  })

  const moderatorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  moderatorRoutes.use('*', requireAuth)
  moderatorRoutes.use('*', requireModerator)

  moderatorRoutes.openapi(listPendingRoute, async (c) => {
    const result = await service.listPending()
    return c.json(result, 200)
  })

  moderatorRoutes.openapi(reviewRoute, async (c) => {
    const { id } = c.req.valid('param')
    const input: ReviewVerificationInput = c.req.valid('json')
    const result = await executeVerification(() => service.review(id, c.var.user.id, input))
    return c.json(result, 200)
  })

  routes.route('/', vendorRoutes)
  routes.route('/', moderatorRoutes)
  return routes
}
