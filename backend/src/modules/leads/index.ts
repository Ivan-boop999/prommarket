import type { DbClient } from '../../db'
import { LeadsService } from './application/leads-service'
import { createPrismaLeadsRepository } from './infrastructure/leads-repository'
import { createLeadsRoutes } from './transport/routes'
import type { MiddlewareHandler } from '../../modules/auth'

type CreateLeadsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createLeadsModule({ db, requireAuth, requireVendor, requireAdmin }: CreateLeadsModuleOptions) {
  const repository = createPrismaLeadsRepository(db)
  const service = new LeadsService({ clock: { now: () => new Date() }, repository })

  const resolveVendorId = async (userId: string): Promise<string | null> => {
    const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
    return vendor?.id ?? null
  }

  return {
    routes: createLeadsRoutes({ requireAuth, requireVendor, requireAdmin, service, resolveVendorId }),
    service,
  }
}

export { LeadsService } from './application/leads-service'
