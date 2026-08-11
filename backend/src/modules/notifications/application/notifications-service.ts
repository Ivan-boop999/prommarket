import type { DbClient } from '../../../db'

/**
 * Notifications service. Notifications are created server-side (by deals,
 * verification, billing modules when events happen) and read by the user in
 * their cabinet. This module exposes the read + mark-read surface; creation
 * is a helper other modules call directly against the repository.
 */

type NotificationRow = {
  id: string
  userId: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

export type NotificationDto = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export class NotificationsService {
  constructor(private readonly db: DbClient) {}

  async listForUser(userId: string, opts: { unreadOnly?: boolean } = {}): Promise<NotificationDto[]> {
    const rows = await this.db.notification.findMany({
      where: opts.unreadOnly ? { userId, isRead: false } : { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return rows.map((r) => toDto(r as NotificationRow))
  }

  async unreadCount(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, isRead: false } })
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  /** Create a notification — called by other modules when an event happens. */
  async create(input: {
    userId: string
    type: string
    title: string
    body?: string
    link?: string
  }): Promise<NotificationDto> {
    const row = await this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })
    return toDto(row as NotificationRow)
  }
}
