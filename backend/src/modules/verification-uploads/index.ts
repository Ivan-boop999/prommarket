import type { PrivateStorageRuntime } from '../../storage'
import { createVerificationUploadRoutes } from './routes'
import type { MiddlewareHandler } from 'hono'

type CreateVerificationUploadsModuleOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  storage: PrivateStorageRuntime
}

export function createVerificationUploadsModule({
  requireAuth,
  requireVendor,
  storage,
}: CreateVerificationUploadsModuleOptions) {
  return {
    routes: createVerificationUploadRoutes({ requireAuth, requireVendor, storage }),
  }
}
