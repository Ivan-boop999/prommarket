import type { DbClient } from '../../db'
import { VerificationService } from './application/verification-service'
import { createPrismaVerificationRepository } from './infrastructure/verification-repository'
import { createVerificationRoutes } from './transport/routes'
import type { MiddlewareHandler } from '../../modules/auth'

type CreateVerificationModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  requireModerator: MiddlewareHandler
}

export function createVerificationModule({
  db,
  requireAuth,
  requireVendor,
  requireModerator,
}: CreateVerificationModuleOptions) {
  const repository = createPrismaVerificationRepository(db)
  const service = new VerificationService({ clock: { now: () => new Date() }, repository })

  const resolveVendorId = async (userId: string): Promise<string | null> => {
    const vendor = await db.vendor.findUnique({ where: { userId }, select: { id: true } })
    return vendor?.id ?? null
  }

  return {
    routes: createVerificationRoutes({
      requireAuth,
      requireVendor,
      requireModerator,
      service,
      resolveVendorId,
    }),
    service,
  }
}

export { VerificationService } from './application/verification-service'
