import type { UserRole } from '@prommarket/contracts'
import { createMiddleware } from 'hono/factory'

import { AppError } from '../../../http/errors'
import type { AuthenticatedPrincipal } from '../domain/user'
import { executeAuth } from './errors'

export type AuthHttpEnv = {
  Variables: {
    user: AuthenticatedPrincipal
  }
}

export function createRequireAuth(
  authenticate: (accessToken: string | undefined) => Promise<AuthenticatedPrincipal>,
) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const accessToken = bearerToken(c.req.header('authorization'))
    const user = await executeAuth(() => authenticate(accessToken))
    c.set('user', user)
    await next()
  })
}

/**
 * Require a single role or any of a set of roles. Passing an array is the
 * multi-role form (e.g. an endpoint open to both `admin` and `moderator`);
 * passing a single string is the strict-equality guard used by the template.
 */
export function createRequireRole(role: UserRole | UserRole[]) {
  return createMiddleware<AuthHttpEnv>(async (c, next) => {
    const allowed = Array.isArray(role) ? role : [role]
    if (!allowed.includes(c.var.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource')
    }
    await next()
  })
}

function bearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length)
}
