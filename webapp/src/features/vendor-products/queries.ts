import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateProductInput, UpdateProductInput } from '@prommarket/contracts'

import { useAuth } from '@/features/auth'
import {
  createVendorProduct,
  deleteVendorProduct,
  listVendorProducts,
  updateVendorProduct,
} from './api'

const vendorQueryKeys = {
  all: ['session', 'vendor-products'] as const,
  list: () => [...vendorQueryKeys.all, 'list'] as const,
}

export function useVendorProductsQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: vendorQueryKeys.list(),
    queryFn: () => listVendorProducts(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useCreateVendorProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => createVendorProduct(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vendorQueryKeys.list() })
    },
  })
}

export function useUpdateVendorProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateVendorProduct(auth.transport, id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vendorQueryKeys.list() })
    },
  })
}

export function useDeleteVendorProductMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVendorProduct(auth.transport, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vendorQueryKeys.list() })
    },
  })
}
