import { useEffect, useRef, useState, useCallback } from 'react'
import type { DealMessage } from '@prommarket/contracts'

/**
 * useDealChat — WebSocket hook for the deal chat.
 *
 * Connects to `/api/deals/:id/ws?token=<accessToken>` on mount, sends
 * `send-message` events, and receives `{ type: 'message', message }` payloads
 * that append to the local message list. Reconnects with backoff on close.
 *
 * The backend persists every message before broadcast (see
 * backend/src/websocket/deal-chat.ts), so the chat survives a restart and
 * history is authoritative in DealMessage, not in this hook.
 */
export function useDealChat(input: {
  dealId: string | undefined
  accessToken: string | undefined
  apiUrl?: string
}) {
  const { dealId, accessToken } = input
  const apiUrl = input.apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
  const [messages, setMessages] = useState<DealMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!dealId || !accessToken) return
    const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/api/deals/${dealId}/ws?token=${encodeURIComponent(accessToken)}`
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      return
    }
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as
          | { type: 'message'; message: DealMessage }
          | { type: 'connected'; dealId: string }
          | { type: 'pong' }
          | { type: 'error'; message: string }
        if (data.type === 'message') {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev
            return [...prev, data.message].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          })
        }
      } catch {
        // Ignore malformed frames.
      }
    }
    ws.onclose = () => {
      setConnected(false)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      reconnectRef.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
  }, [dealId, accessToken, apiUrl])

  useEffect(() => {
    setMessages([])
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'send-message', content }))
  }, [])

  return { messages, connected, sendMessage }
}
