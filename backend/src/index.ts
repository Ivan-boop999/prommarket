import { createApp } from './app'
import { createBackendRuntime } from './runtime'
import { shutdownBackend } from './shutdown'
import { verifyAccessToken } from './modules/auth'
import { DealsService } from './modules/deals'
import { createPrismaDealsRepository } from './modules/deals'
import { createDealChatHandlers, type DealChatSocketData } from './websocket/deal-chat'

const runtime = createBackendRuntime()
const app = createApp({
  backgroundTasks: runtime.backgroundTasks,
  emailDelivery: runtime.emailDelivery,
  env: runtime.env,
  prisma: runtime.prisma,
  privateStorage: runtime.privateStorage,
})

// A deals service for the WebSocket chat: messages are persisted through the
// same application layer the HTTP routes use.
const dealsService = new DealsService({
  clock: { now: () => new Date() },
  repository: createPrismaDealsRepository(runtime.prisma),
})
const chatHandlers = createDealChatHandlers(dealsService)

/**
 * Bun.serve with WebSocket support for the deal chat.
 *
 * The fetch handler delegates to the Hono app for every request except WS
 * upgrades on `/api/deals/:id/ws`. Bun's `fetch` may be async and return a
 * Promise<Response>; that is supported. The previous 503 issue was caused by
 * an unhandled throw inside the handler; the try/catch here surfaces it as a
 * 500 instead of Bun's opaque 503.
 */
const server = Bun.serve<DealChatSocketData>({
  port: runtime.env.PORT,
  websocket: {
    open: (ws) => chatHandlers.open(ws),
    message: (ws, message) => chatHandlers.message(ws, message),
    close: (ws) => chatHandlers.close(ws),
  },
  async fetch(req, server) {
    const url = new URL(req.url)
    // WS upgrade: /api/deals/:id/ws?token=<accessToken>.
    const upgradeHeader = req.headers.get('upgrade') ?? ''
    if (
      url.pathname.startsWith('/api/deals/') &&
      url.pathname.endsWith('/ws') &&
      upgradeHeader.toLowerCase().includes('websocket')
    ) {
      const token = url.searchParams.get('token')
      if (!token) return new Response('Missing token', { status: 401 })

      try {
        const payload = await verifyAccessToken(token, runtime.env)
        const user = await runtime.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { role: true },
        })
        if (!user) return new Response('User not found', { status: 401 })

        const segments = url.pathname.split('/').filter(Boolean)
        const dealId = segments[2]
        if (!dealId) return new Response('Missing deal id', { status: 400 })

        const data: DealChatSocketData = {
          dealId,
          userId: payload.sub,
          userRole: user.role,
        }
        if (server.upgrade(req, { data })) return
        return new Response('Upgrade failed', { status: 500 })
      } catch {
        return new Response('Invalid token', { status: 401 })
      }
    }

    // Everything else: delegate to the Hono app. Wrap in try/catch so a thrown
    // error surfaces as a logged 500 instead of Bun's opaque 503.
    try {
      return await app.fetch(req)
    } catch (error) {
      console.error('[index] app.fetch threw:', error)
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }
  },
})

console.log(`Backend listening on ${server.url}`)

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true

  console.log(`Backend received ${signal}; shutting down`)
  await shutdownBackend(
    server,
    runtime,
    runtime.env.SHUTDOWN_GRACE_SECONDS * 1000,
  )
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
