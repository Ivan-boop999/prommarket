import type { DbClient } from '../../db'
import { BillingService } from './application/billing-service'
import { createPrismaBillingRepository } from './infrastructure/billing-repository'
import { createBillingRoutes } from './transport/routes'
import type { MiddlewareHandler } from 'hono'

type CreateBillingModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireAdmin: MiddlewareHandler
}

export function createBillingModule({ db, requireAuth, requireVendor, requireAdmin }: CreateBillingModuleOptions) {
  const repository = createPrismaBillingRepository(db)
  const service = new BillingService({ clock: { now: () => new Date() }, repository })

  const resolveVendorId = async (userId: string): Promise<string | null> => {
    const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
    return vendor?.id ?? null
  }

  return {
    routes: createBillingRoutes({ requireAuth, requireVendor, requireAdmin, service, resolveVendorId }),
    service,
  }
}

export { BillingService } from './application/billing-service'
export { allocateInvoiceNumber, addDays, addMonths } from './infrastructure/mappers'
