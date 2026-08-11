import type { DbClient } from '../db'
import type { DealsService } from '../modules/deals/application/deals-service'
import type { BrokerService } from '../modules/broker/application/broker-service'

/**
 * WebSocket deal chat.
 *
 * One Bun.serve instance handles both HTTP (the Hono app) and WebSocket upgrades.
 * The upgrade route is `/api/deals/:id/ws?token=<accessToken>`; auth reuses the
 * same access-token verification as HTTP. Messages are persisted to DealMessage
 * via the DealsService before broadcast, so the chat survives a restart.
 *
 * Rooms are keyed by dealId. A single-instance deployment does not need Redis;
 * the README notes managed Valkey for horizontal scaling only.
 */

export type DealChatServerOptions = {
  dealsService: DealsService
  brokerService: BrokerService
  prisma: DbClient
}

type ChatSocketData = {
  dealId: string
  userId: string
  userRole: string
}

type IncomingMessage =
  | { type: 'send-message'; content: string }
  | { type: 'ping' }

/**
 * A minimal pub/sub room manager. Bun's Server.publish handles the actual fan-out;
 * we only track which dealId each socket subscribed to so unsubscribe on close works.
 */
export function createDealChatHandlers(options: DealChatServerOptions) {
  const { dealsService } = options

  return {
    onOpen: () => {
      // Nothing to do; the socket is ready to receive messages.
    },
    onMessage: async (ws: Bun.SocketHandler<ChatSocketData>, message: Buffer | string) => {
      const text = typeof message === 'string' ? message : message.toString('utf8')
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
        const data = ws.data as ChatSocketData | undefined
        if (!data) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
          return
        }
        const senderRole = (data.userRole === 'broker' ? 'broker'
          : data.userRole === 'vendor' ? 'vendor' : 'buyer') as 'broker' | 'vendor' | 'buyer'
        const saved = await dealsService.addMessage(data.dealId, data.userId, senderRole, {
          content: parsed.content,
        })
        const payload = JSON.stringify({
          type: 'message',
          message: saved,
        })
        // Broadcast to the deal room. Bun's publish targets all subscribers of the topic.
        ws.publish(`deal:${data.dealId}`, payload)
        ws.send(payload)
      }
    },
    onClose: () => {
      // Unsubscribe is implicit when the socket closes.
    },
  }
}

export type { ChatSocketData }
