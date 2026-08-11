import { HttpClient } from './http-client'

/**
 * A plain HTTP client for endpoints that must work for anonymous visitors.
 *
 * The authenticated `AuthenticatedTransport` (from `useAuth().transport`) is only
 * available after the auth bootstrap finishes and only attaches credentials. The
 * public catalog — categories, product list, product detail, vendors, search —
 * is browseable without an account, so it uses this singleton instead.
 *
 * It still parses responses against the same Zod schemas and throws the same
 * `ApiRequestError` shape as the authenticated transport, so feature code is
 * uniform regardless of which transport it uses.
 */
export const publicClient = new HttpClient()
