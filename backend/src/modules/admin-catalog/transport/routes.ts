import {
  apiErrorSchema,
  attributeSchema,
  createAttributeInputSchema,
  createCategoryInputSchema,
  flatCategorySchema,
  updateCategoryInputSchema,
  type CreateAttributeInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import { executeAdminCatalog } from './errors'
import type { AdminCatalogService } from '../application/admin-catalog-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]
const idParamsSchema = z.object({ id: z.uuid() }).strict()

// --- Categories ---

const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/categories',
  security: bearerSecurity,
  responses: {
    200: { description: 'Categories (flat)', content: { 'application/json': { schema: z.array(flatCategorySchema) } } },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
  },
})

const createCategoryRoute = createRoute({
  method: 'post',
  path: '/categories',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createCategoryInputSchema } } } },
  responses: {
    201: { description: 'Category created', content: { 'application/json': { schema: flatCategorySchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    409: { content: errorContent, description: 'Slug taken' },
  },
})

const updateCategoryRoute = createRoute({
  method: 'patch',
  path: '/categories/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema, body: { content: { 'application/json': { schema: updateCategoryInputSchema } } } },
  responses: {
    200: { description: 'Category updated', content: { 'application/json': { schema: flatCategorySchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Category not found' },
    409: { content: errorContent, description: 'Slug taken / has children' },
  },
})

const deleteCategoryRoute = createRoute({
  method: 'delete',
  path: '/categories/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    204: { description: 'Category deleted' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Category not found' },
    409: { content: errorContent, description: 'Has children' },
  },
})

// --- Attributes ---

const listAttributesRoute = createRoute({
  method: 'get',
  path: '/attributes',
  security: bearerSecurity,
  responses: {
    200: { description: 'Attributes', content: { 'application/json': { schema: z.array(attributeSchema) } } },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
  },
})

const createAttributeRoute = createRoute({
  method: 'post',
  path: '/attributes',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createAttributeInputSchema } } } },
  responses: {
    201: { description: 'Attribute created', content: { 'application/json': { schema: attributeSchema } } },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    409: { content: errorContent, description: 'Slug taken' },
  },
})

const deleteAttributeRoute = createRoute({
  method: 'delete',
  path: '/attributes/{id}',
  security: bearerSecurity,
  request: { params: idParamsSchema },
  responses: {
    204: { description: 'Attribute deleted' },
    401: { content: errorContent, description: 'Authentication required' },
    403: { content: errorContent, description: 'Admin access required' },
    404: { content: errorContent, description: 'Attribute not found' },
  },
})

type CreateAdminCatalogRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireAdmin: MiddlewareHandler
  service: AdminCatalogService
}

export function createAdminCatalogRoutes({
  requireAuth,
  requireAdmin,
  service,
}: CreateAdminCatalogRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)
  routes.use('*', requireAdmin)

  routes.openapi(listCategoriesRoute, async (c) => c.json(await service.listCategories(), 200))
  routes.openapi(createCategoryRoute, async (c) => {
    const input: CreateCategoryInput = c.req.valid('json')
    const cat = await executeAdminCatalog(() => service.createCategory(input))
    return c.json(cat, 201)
  })
  routes.openapi(updateCategoryRoute, async (c) => {
    const { id } = c.req.valid('param')
    const input: UpdateCategoryInput = c.req.valid('json')
    const cat = await executeAdminCatalog(() => service.updateCategory(id, input))
    return c.json(cat, 200)
  })
  routes.openapi(deleteCategoryRoute, async (c) => {
    const { id } = c.req.valid('param')
    await executeAdminCatalog(() => service.deleteCategory(id))
    return c.body(null, 204)
  })

  routes.openapi(listAttributesRoute, async (c) => c.json(await service.listAttributes(), 200))
  routes.openapi(createAttributeRoute, async (c) => {
    const input: CreateAttributeInput = c.req.valid('json')
    const attr = await executeAdminCatalog(() => service.createAttribute(input))
    return c.json(attr, 201)
  })
  routes.openapi(deleteAttributeRoute, async (c) => {
    const { id } = c.req.valid('param')
    await executeAdminCatalog(() => service.deleteAttribute(id))
    return c.body(null, 204)
  })

  return routes
}
