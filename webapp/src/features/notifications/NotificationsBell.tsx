import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAuth } from '@/features/auth'
import { getUnreadCount, listNotifications, markAllRead } from './api'

/**
 * Notifications bell for the workspace header. Shows an unread badge; opens a
 * popover with the latest notifications and a "mark all read" action. Polls
 * every 60s so the badge stays fresh without WS push.
 */
export function NotificationsBell() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const countQuery = useQuery({
    queryKey: ['session', 'notifications', 'unread-count'],
    queryFn: () => getUnreadCount(auth.transport),
    enabled: auth.isAuthenticated,
    refetchInterval: 60_000,
  })

  const listQuery = useQuery({
    queryKey: ['session', 'notifications', 'list'],
    queryFn: () => listNotifications(auth.transport),
    enabled: auth.isAuthenticated && open,
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllRead(auth.transport),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session', 'notifications'] })
    },
  })

  if (!auth.isAuthenticated) return null

  const unread = countQuery.data ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Уведомления">
          <span className="text-lg">🔔</span>
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-xs"
            >
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">Уведомления</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto text-xs"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Прочитать все
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(listQuery.data ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Нет уведомлений</p>
          ) : (
            (listQuery.data ?? []).slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`border-b p-3 last:border-b-0 ${n.isRead ? '' : 'bg-accent/50'}`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
