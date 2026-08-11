import {
  apiErrorSchema,
  createProductInputSchema,
  productDetailSchema,
  updateProductInputSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv, MiddlewareHandler } from '../../auth'
import { executeVendorProducts } from './errors'
import type { VendorProductsService } from '../application/vendor-products-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]
const idParamsSchema = z.object({ id: z.uuid() }).strict()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  responses: {
    200: { description: 'Vendor products', content: { 'application/json': { schema: z.array(productDetailSchema) } } },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    200: { description: 'Product detail', content: { 'application/json': { schema: productDetailSchema } } },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Not owner' },
    404: { content: errorContent, description: 'Product not found' },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createProductInputSchema } } } },
  responses: {
    201: { description: 'Product created', content: { 'application/json': { schema: productDetailSchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Vendor access required' },
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema, body: { content: { 'application/json': { schema: updateProductInputSchema } } } },
  responses: {
    200: { description: 'Product updated', content: { 'application/json': { schema: productDetailSchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Not owner' },
    404: { content: errorContent, description: 'Product not found' },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    204: { description: 'Product deleted' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Not owner' },
    404: { content: errorContent, description: 'Product not found' },
  },
})

type CreateVendorProductsRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  service: VendorProductsService
  resolveVendorId: (userId: string) => Promise<string | null>
}

export function createVendorProductsRoutes({
  requireAuth,
  requireVendor,
  service,
  resolveVendorId,
}: CreateVendorProductsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)
  routes.use('*', requireVendor)

  routes.openapi(listRoute, async (c) => {
    const vendorId = (await resolveVendorId(c.var.user.id)) ?? ''
    const items = await service.list(vendorId)
    return c.json(items, 200)
  })

  routes.openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param')
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404)
    const product = await executeVendorProducts(() => service.get(vendorId, id))
    if (!product) return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404)
    return c.json(product, 200)
  })

  routes.openapi(createRouteDef, async (c) => {
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404)
    const input: CreateProductInput = c.req.valid('json')
    const product = await executeVendorProducts(() => service.create(vendorId, input))
    return c.json(product, 201)
  })

  routes.openapi(updateRoute, async (c) => {
    const { id } = c.req.valid('param')
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404)
    const input: UpdateProductInput = c.req.valid('json')
    const product = await executeVendorProducts(() => service.update(vendorId, id, input))
    return c.json(product, 200)
  })

  routes.openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')
    const vendorId = await resolveVendorId(c.var.user.id)
    if (!vendorId) return c.json({ error: { code: 'NOT_FOUND', message: 'Vendor not found' } }, 404)
    await executeVendorProducts(() => service.remove(vendorId, id))
    return c.body(null, 204)
  })

  return routes
}
