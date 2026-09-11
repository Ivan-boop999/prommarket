import {
  apiErrorSchema,
  createReviewInputSchema,
  productReviewSchema,
  reviewVendorReplyInputSchema,
  type CreateReviewInput,
  type ReviewVendorReplyInput,
} from '@prommarket/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeReviews } from './errors'
import type { ReviewsService } from '../application/reviews-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]
const productIdParamsSchema = z.object({ productId: z.uuid() }).strict()
const reviewIdParamsSchema = z.object({ reviewId: z.uuid() }).strict()

const listForProductRoute = createRoute({
  method: 'get',
  path: '/products/{productId}/reviews',
  request: { params: productIdParamsSchema },
  responses: {
    200: { description: 'Product reviews', content: { 'application/json': { schema: z.array(productReviewSchema) } } },
  },
})

const createReviewRoute = createRoute({
  method: 'post',
  path: '/products/{productId}/reviews',
  security: bearerSecurity,
  request: {
    params: productIdParamsSchema,
    body: { content: { 'application/json': { schema: createReviewInputSchema } } },
  },
  responses: {
    201: { description: 'Review created', content: { 'application/json': { schema: productReviewSchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Buyer access required' },
    409: { content: errorContent, description: 'Already reviewed' },
  },
})

const addVendorReplyRoute = createRoute({
  method: 'post',
  path: '/reviews/{reviewId}/reply',
  security: bearerSecurity,
  request: {
    params: reviewIdParamsSchema,
    body: { content: { 'application/json': { schema: reviewVendorReplyInputSchema } } },
  },
  responses: {
    200: { description: 'Reply added', content: { 'application/json': { schema: productReviewSchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Not the product vendor' },
    404: { content: errorContent, description: 'Review not found' },
  },
})

type CreateReviewsRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireBuyer: MiddlewareHandler
  requireVendor: MiddlewareHandler
  service: ReviewsService
}

export function createReviewsRoutes({
  requireAuth,
  requireBuyer,
  requireVendor,
  service,
}: CreateReviewsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // Public: list reviews for a product.
  routes.openapi(listForProductRoute, async (c) => {
    const { productId } = c.req.valid('param')
    return c.json(await service.listForProduct(productId), 200)
  })

  // Buyer: create a review.
  const buyerRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  buyerRoutes.use('*', requireAuth)
  buyerRoutes.use('*', requireBuyer)
  buyerRoutes.openapi(createReviewRoute, async (c) => {
    const { productId } = c.req.valid('param')
    const input: CreateReviewInput = c.req.valid('json')
    const review = await executeReviews(() => service.create(c.var.user.id, productId, input))
    return c.json(review, 201)
  })

  // Vendor: reply to a review.
  const vendorRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  vendorRoutes.use('*', requireAuth)
  vendorRoutes.use('*', requireVendor)
  vendorRoutes.openapi(addVendorReplyRoute, async (c) => {
    const { reviewId } = c.req.valid('param')
    const input: ReviewVendorReplyInput = c.req.valid('json')
    const review = await executeReviews(() => service.addVendorReply(c.var.user.id, reviewId, input))
    return c.json(review, 200)
  })

  routes.route('/', buyerRoutes)
  routes.route('/', vendorRoutes)
  return routes
}
