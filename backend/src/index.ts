import { createApp } from './app'
import { createBackendRuntime } from './runtime'
import { shutdownBackend } from './shutdown'
import { verifyAccessToken } from './modules/auth/infrastructure/access-tokens'
import { createPrismaDealsRepository } from './modules/deals/infrastructure/deals-repository'
import { DealsService } from './modules/deals/application/deals-service'
import { createDealChatHandlers, type DealChatSocketData } from './websocket/deal-chat'

const runtime = createBackendRuntime()
const app = createApp({
  backgroundTasks: runtime.backgroundTasks,
  emailDelivery: runtime.emailDelivery,
  env: runtime.env,
  prisma: runtime.prisma,
  privateStorage: runtime.privateStorage,
})

// A deals service instance for the WebSocket chat: messages are persisted
// through the same application layer the HTTP routes use.
const dealsService = new DealsService({
  clock: { now: () => new Date() },
  repository: createPrismaDealsRepository(runtime.prisma),
})
const chatHandlers = createDealChatHandlers(dealsService)

const UPGRADE_PATH = '/api/deals/'
const UPGRADE_SUFFIX = '/ws'

const server = Bun.serve({
  port: runtime.env.PORT,
  websocket: {
    open: (ws) => chatHandlers.open(ws as never),
    message: (ws, message) => chatHandlers.message(ws as never, message),
    close: (ws) => chatHandlers.close(ws as never),
  },
  async fetch(req, server) {
    const url = new URL(req.url)
    // WS upgrade: /api/deals/:id/ws?token=<accessToken>. The Upgrade header
    // check is intentionally loose (case-insensitive contains) because Bun's
    // client and browsers vary in capitalization.
    const upgradeHeader = req.headers.get('upgrade') ?? ''
    if (
      url.pathname.startsWith(UPGRADE_PATH) &&
      url.pathname.endsWith(UPGRADE_SUFFIX) &&
      upgradeHeader.toLowerCase().includes('websocket')
    ) {
      return upgradeDealChat(req, server)
    }
    return app.fetch(req)
  },
})

async function upgradeDealChat(req: Request, server: ReturnType<typeof Bun.serve>) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return new Response('Missing token', { status: 401 })

  let principal: { sub: string; role: string }
  try {
    principal = await verifyAccessTokenPayload(token)
  } catch {
    return new Response('Invalid token', { status: 401 })
  }

  // /api/deals/:id/ws → dealId is the middle segment.
  const segments = url.pathname.split('/').filter(Boolean)
  const dealId = segments[2] // ['api','deals','<id>','ws']
  if (!dealId) return new Response('Missing deal id', { status: 400 })

  const data: DealChatSocketData = {
    dealId,
    userId: principal.sub,
    userRole: principal.role,
  }
  // Upgrade must use the original request; a fresh Request loses the WS context.
  if (server.upgrade(req, { data })) return undefined
  return new Response('Upgrade failed', { status: 500 })
}

/** Verify the access token and load the user's role from the DB. The JWT
 * carries only sub/sessionId/email (not role), so we look the role up once
 * at upgrade time and attach it to the socket data. */
async function verifyAccessTokenPayload(token: string): Promise<{ sub: string; role: string }> {
  const payload = await verifyAccessToken(token, runtime.env)
  const user = await runtime.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { role: true },
  })
  if (!user) throw new Error('User not found')
  return { sub: payload.sub, role: user.role }
}

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
