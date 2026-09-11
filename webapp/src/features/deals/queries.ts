import { useQuery } from '@tanstack/react-query'
import type { DealsQuery } from '@prommarket/contracts'

import { useAuth } from '@/features/auth'
import { listMyDeals } from './api'

const dealsQueryKeys = {
  all: ['session', 'deals'] as const,
  my: (query: DealsQuery) => [...dealsQueryKeys.all, 'me', query] as const,
}

export function useMyDealsQuery(query: DealsQuery = { page: 1, pageSize: 20 }) {
  const auth = useAuth()
  return useQuery({
    queryKey: dealsQueryKeys.my(query),
    queryFn: () => listMyDeals(auth.transport, query),
    enabled: auth.isAuthenticated,
  })
}
