import { apiErrorSchema } from '@web-app-demo/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import type { AuthHttpEnv } from '../../auth'
import type { MiddlewareHandler } from 'hono'
import type { NotificationsService } from '../application/notifications-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const notificationSchema = z
  .object({
    id: z.uuid(),
    type: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    link: z.string().nullable(),
    isRead: z.boolean(),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  request: { query: z.object({ unreadOnly: z.string().optional() }).strict() },
  responses: {
    200: { description: 'Notifications', content: { 'application/json': { schema: z.array(notificationSchema) } } },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const unreadCountRoute = createRoute({
  method: 'get',
  path: '/unread-count',
  security: bearerSecurity,
  responses: {
    200: { description: 'Unread count', content: { 'application/json': { schema: z.object({ count: z.number().int() }).strict() } } },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const markAllReadRoute = createRoute({
  method: 'post',
  path: '/mark-all-read',
  security: bearerSecurity,
  responses: {
    204: { description: 'All marked read' },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

type CreateNotificationsRoutesOptions = {
  requireAuth: MiddlewareHandler
  service: NotificationsService
}

export function createNotificationsRoutes({ requireAuth, service }: CreateNotificationsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)

  routes.openapi(listRoute, async (c) => {
    const { unreadOnly } = c.req.valid('query')
    const items = await service.listForUser(c.var.user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
    })
    return c.json(items, 200)
  })

  routes.openapi(unreadCountRoute, async (c) => {
    const count = await service.unreadCount(c.var.user.id)
    return c.json({ count }, 200)
  })

  routes.openapi(markAllReadRoute, async (c) => {
    await service.markAllRead(c.var.user.id)
    return c.body(null, 204)
  })

  return routes
}
