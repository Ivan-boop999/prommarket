import { useState, useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import type { DealMessage } from '@prommarket/contracts'
import { useDealChat } from './useDealChat'
import { getDeal } from './api'

/**
 * Deal chat panel. Renders persisted history (loaded once via HTTP) plus live
 * messages arriving over WebSocket. Send box is disabled until the socket
 * connects; the backend persists and broadcasts each message.
 */
export function DealChat({ dealId }: { dealId: string }) {
  const auth = useAuth()
  const detailQuery = useQuery({
    queryKey: ['session', 'deals', dealId],
    queryFn: () => getDeal(auth.transport, dealId),
    enabled: Boolean(dealId),
  })
  const { messages: liveMessages, connected, sendMessage } = useDealChat({
    dealId,
    accessToken: auth.accessToken ?? undefined,
  })

  // Seed history from the HTTP detail, then let live messages append.
  const history = detailQuery.data?.messages ?? []
  const seededIds = new Set(history.map((m) => m.id))
  const allMessages = [...history, ...liveMessages.filter((m) => !seededIds.has(m.id))]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [allMessages.length])

  return (
    <div className="flex h-96 flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Чат по сделке</span>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? '● Онлайн' : '○ Подключение…'}
        </Badge>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {detailQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : allMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Сообщений пока нет. Начните обсуждение.
          </p>
        ) : (
          allMessages.map((m) => (
            <MessageBubble key={m.id} message={m} currentUserId={auth.user?.id} />
          ))
        )}
      </div>
      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.trim()) {
            sendMessage(draft.trim())
            setDraft('')
          }
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? 'Сообщение…' : 'Ожидание подключения…'}
          disabled={!connected}
        />
        <Button type="submit" size="sm" disabled={!connected || !draft.trim()}>
          Отправить
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ message, currentUserId }: { message: DealMessage; currentUserId?: string }) {
  const isMe = message.senderId === currentUserId
  const roleLabel = message.senderRole === 'broker' ? 'Брокер'
    : message.senderRole === 'vendor' ? 'Поставщик'
      : 'Покупатель'
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {!isMe && (
          <div className="mb-0.5 text-xs font-medium opacity-80">{roleLabel}</div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        <div className={`mt-0.5 text-xs ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
