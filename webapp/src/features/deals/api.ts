import {
  dealDetailSchema,
  dealListItemSchema,
  dealsQuerySchema,
  paginatedResponseSchema,
  type DealsQuery,
} from '@web-app-demo/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

/** Deals API for the authenticated user (scoped by role server-side via /me). */

export function listMyDeals(
  transport: AuthenticatedTransport,
  query: DealsQuery,
) {
  const q = dealsQuerySchema.parse(query)
  const search = new URLSearchParams({
    page: String(q.page),
    pageSize: String(q.pageSize),
  })
  for (const s of q.status ?? []) search.append('status', s)
  for (const t of q.type ?? []) search.append('type', t)
  return transport.request(
    `/api/deals/me?${search}`,
    paginatedResponseSchema(dealListItemSchema),
  )
}

export function getDeal(transport: AuthenticatedTransport, id: string) {
  return transport.request(`/api/deals/${encodeURIComponent(id)}`, dealDetailSchema)
}
