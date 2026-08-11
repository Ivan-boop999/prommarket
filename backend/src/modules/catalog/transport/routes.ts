import {
  flatCategorySchema,
  categorySchema,
  paginatedResponseSchema,
  productDetailSchema,
  productListItemSchema,
  productsQuerySchema,
  searchQuerySchema,
  searchResultSchema,
  vendorSummarySchema,
  type ProductsQuery,
} from '@web-app-demo/contracts'
import { apiErrorSchema } from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { CatalogService } from '../application/catalog-service'
import { executeCatalog } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

// ---------------------------------------------------------------------------
// Route definitions
//
// Catalog endpoints are public: a buyer must be able to browse the marketplace
// before signing in. No `security: bearerSecurity` and no `requireAuth` on the
// sub-app. Write endpoints (vendor product CRUD) will live behind a separate
// guarded sub-app in a later iteration.
// ---------------------------------------------------------------------------

const listCategoriesTreeRoute = createRoute({
  method: 'get',
  path: '/categories',
  request: {
    query: z.object({ flat: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Category tree (or flat list with ?flat=true)',
      content: {
        'application/json': {
          schema: z.union([z.array(categorySchema), z.array(flatCategorySchema)]),
        },
      },
    },
  },
})

const listProductsRoute = createRoute({
  method: 'get',
  path: '/products',
  request: { query: productsQuerySchema },
  responses: {
    200: {
      description: 'Paginated product list',
      content: {
        'application/json': { schema: paginatedResponseSchema(productListItemSchema) },
      },
    },
    400: { content: errorContent, description: 'Invalid query' },
  },
})

const productParamsSchema = z.object({ id: z.uuid() }).strict()

const getProductRoute = createRoute({
  method: 'get',
  path: '/products/{id}',
  request: { params: productParamsSchema },
  responses: {
    200: {
      description: 'Product detail',
      content: { 'application/json': { schema: productDetailSchema } },
    },
    400: { content: errorContent, description: 'Invalid id' },
    404: { content: errorContent, description: 'Product not found' },
  },
})

const listVendorsRoute = createRoute({
  method: 'get',
  path: '/vendors',
  responses: {
    200: {
      description: 'Vendors',
      content: { 'application/json': { schema: z.array(vendorSummarySchema) } },
    },
  },
})

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: { query: searchQuerySchema },
  responses: {
    200: {
      description: 'Search results',
      content: { 'application/json': { schema: searchResultSchema } },
    },
    400: { content: errorContent, description: 'Invalid query' },
  },
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type CreateCatalogRoutesOptions = {
  service: CatalogService
}

export function createCatalogRoutes({ service }: CreateCatalogRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.openapi(listCategoriesTreeRoute, async (c) => {
    const { flat } = c.req.valid('query')
    const wantFlat = flat === 'true' || flat === '1'
    const result = wantFlat ? await service.flatCategories() : await service.categoryTree()
    return c.json(result, 200)
  })

  routes.openapi(listProductsRoute, async (c) => {
    const query: ProductsQuery = c.req.valid('query')
    const result = await service.listProducts(query)
    return c.json(result, 200)
  })

  routes.openapi(getProductRoute, async (c) => {
    const { id } = c.req.valid('param')
    const product = await executeCatalog(() => service.getProduct(id))
    return c.json(product, 200)
  })

  routes.openapi(listVendorsRoute, async (c) => {
    const vendors = await service.listVendors()
    return c.json(vendors, 200)
  })

  routes.openapi(searchRoute, async (c) => {
    const { query, page, pageSize, categoryId } = c.req.valid('query')
    const result = await service.search({ query, page, pageSize, categoryId })
    return c.json(result, 200)
  })

  return routes
}

export { listProductsRoute, getProductRoute, searchRoute, listCategoriesTreeRoute, listVendorsRoute }
