import { z } from 'zod'
import type { AuthenticatedTransport } from '@/platform/api'

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

export type Notification = z.infer<typeof notificationSchema>

export function listNotifications(transport: AuthenticatedTransport): Promise<Notification[]> {
  return transport.request('/api/notifications', z.array(notificationSchema))
}

export function getUnreadCount(transport: AuthenticatedTransport): Promise<number> {
  return transport.request(
    '/api/notifications/unread-count',
    z.object({ count: z.number().int() }).strict(),
  ).then((r) => r.count)
}

export async function markAllRead(transport: AuthenticatedTransport): Promise<void> {
  await transport.request('/api/notifications/mark-all-read', z.unknown(), { method: 'POST' })
}
