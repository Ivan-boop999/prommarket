import type { ServerWebSocket } from 'bun'
import type { DealsService } from '../modules/deals/application/deals-service'

/**
 * Bun WebSocket deal chat.
 *
 * One Bun.serve instance handles both HTTP (the Hono app) and WebSocket
 * upgrades. The upgrade happens in a route handler; this module owns the
 * websocket handlers (open/message/close) and the message protocol.
 *
 * Rooms are keyed by dealId via Bun's native pub/sub: a socket subscribes to
 * `deal:<id>` on open, and messages are published to that topic so every
 * participant in the deal receives them. Messages are persisted to
 * DealMessage through the DealsService before broadcast, so the chat survives
 * a restart.
 *
 * Auth: the upgrade handler verifies the access token (query param, since
 * browsers cannot set Authorization on WS handshake) and attaches the user
 * id + role to the socket data; every message re-reads it.
 */

export type DealChatSocketData = {
  dealId: string
  userId: string
  userRole: string
}

export type DealChatHandlers = {
  open(ws: ServerWebSocket<DealChatSocketData>): void
  message(ws: ServerWebSocket<DealChatSocketData>, message: string | Buffer): void
  close(ws: ServerWebSocket<DealChatSocketData>): void
}

type IncomingMessage =
  | { type: 'send-message'; content: string }
  | { type: 'ping' }

/**
 * Create the websocket handlers bound to a DealsService. The service persists
 * each message before broadcast; a persisted message carries the author id and
 * role so every client renders it consistently.
 */
export function createDealChatHandlers(dealsService: DealsService): DealChatHandlers {
  return {
    open(ws) {
      // Subscribe to the deal's room so publish() reaches this socket.
      ws.subscribe(`deal:${ws.data.dealId}`)
      ws.send(JSON.stringify({ type: 'connected', dealId: ws.data.dealId }))
    },

    async message(ws, raw) {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
      let parsed: IncomingMessage
      try {
        parsed = JSON.parse(text) as IncomingMessage
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
        return
      }

      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        return
      }

      if (parsed.type === 'send-message') {
        const { dealId, userId, userRole } = ws.data
        const senderRole =
          userRole === 'broker' ? 'broker'
            : userRole === 'vendor' ? 'vendor'
              : 'buyer'
        try {
          const saved = await dealsService.addMessage(dealId, userId, senderRole, {
            content: parsed.content,
          })
          const payload = JSON.stringify({ type: 'message', message: saved })
          // Broadcast to the deal room (everyone including sender sees it).
          ws.publish(`deal:${dealId}`, payload)
          // Echo back to the sender too — publish() does not loop back.
          ws.send(payload)
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Failed to send message',
            }),
          )
        }
      }
    },

    close(ws) {
      // Bun auto-unsubscribes on close; nothing to clean up.
      ws.unsubscribe(`deal:${ws.data.dealId}`)
    },
  }
}

/** Helper to build the socket data passed to server.upgrade(). */
export function buildSocketData(input: {
  dealId: string
  userId: string
  userRole: string
}): DealChatSocketData {
  return input
}
