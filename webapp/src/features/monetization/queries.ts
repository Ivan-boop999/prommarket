import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  BrokerFeesQuery,
  CreateFeaturedPlacementInput,
  CreateSubscriptionInput,
  CreateVerificationRequestInput,
  PurchaseLeadCreditsInput,
  ReviewVerificationInput,
  ActivateAddOnInput,
} from '@prommarket/contracts'

import { useAuth } from '@/features/auth'
import {
  activateAddOn,
  confirmAddOn,
  confirmBrokerFeePayment,
  confirmFeatured,
  confirmLeadPurchase,
  confirmSubscriptionInvoice,
  createFeaturedPlacement,
  createVerificationRequest,
  getBrokerStats,
  getCurrentSubscription,
  getLeadCreditBalance,
  getLeadCreditLedger,
  getLeadCreditPrice,
  getMyVerificationRequest,
  invoiceBrokerFee,
  listBrokerFees,
  listInvoices,
  listPendingVerification,
  listSubscriptionInvoices,
  listSubscriptionPlans,
  purchaseLeadCredits,
  reviewVerification,
  subscribe,
  submitVerificationRequest,
  unlockLead,
} from './api'

/**
 * Query keys for monetization. Session-scoped because every call depends on
 * the authenticated principal (vendor/broker/admin/moderator). Public reads
 * (plans, price) root separately so they are not refetched on logout.
 */
export const monetizationQueryKeys = {
  public: ['monetization'] as const,
  plans: () => [...monetizationQueryKeys.public, 'plans'] as const,
  leadPrice: () => [...monetizationQueryKeys.public, 'lead-price'] as const,
  session: ['session', 'monetization'] as const,
  subscription: () => [...monetizationQueryKeys.session, 'subscription'] as const,
  subscriptionInvoices: () => [...monetizationQueryKeys.session, 'subscription-invoices'] as const,
  leadBalance: () => [...monetizationQueryKeys.session, 'lead-balance'] as const,
  leadLedger: () => [...monetizationQueryKeys.session, 'lead-ledger'] as const,
  invoices: () => [...monetizationQueryKeys.session, 'invoices'] as const,
  verification: () => [...monetizationQueryKeys.session, 'verification'] as const,
  pendingVerification: () => [...monetizationQueryKeys.session, 'pending-verification'] as const,
  brokerFees: (query: BrokerFeesQuery) => [...monetizationQueryKeys.session, 'broker-fees', query] as const,
  brokerStats: () => [...monetizationQueryKeys.session, 'broker-stats'] as const,
}

// --- Public reads ---

export function useSubscriptionPlansQuery() {
  return useQuery({
    queryKey: monetizationQueryKeys.plans(),
    queryFn: () => listSubscriptionPlans(),
  })
}

export function useLeadCreditPriceQuery() {
  return useQuery({
    queryKey: monetizationQueryKeys.leadPrice(),
    queryFn: () => getLeadCreditPrice(),
  })
}

// --- Vendor: subscriptions ---

export function useCurrentSubscriptionQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.subscription(),
    queryFn: () => getCurrentSubscription(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useSubscriptionInvoicesQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.subscriptionInvoices(),
    queryFn: () => listSubscriptionInvoices(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useSubscribeMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) => subscribe(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.subscription() })
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.subscriptionInvoices() })
    },
  })
}

// --- Vendor: lead credits ---

export function useLeadBalanceQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.leadBalance(),
    queryFn: () => getLeadCreditBalance(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useLeadLedgerQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.leadLedger(),
    queryFn: () => getLeadCreditLedger(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function usePurchaseLeadCreditsMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseLeadCreditsInput) => purchaseLeadCredits(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.leadLedger() })
    },
  })
}

export function useUnlockLeadMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (referenceId: string) => unlockLead(auth.transport, referenceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.leadBalance() })
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.leadLedger() })
    },
  })
}

// --- Vendor: verification ---

export function useMyVerificationQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.verification(),
    queryFn: () => getMyVerificationRequest(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useCreateVerificationMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVerificationRequestInput) =>
      createVerificationRequest(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.verification() })
    },
  })
}

export function useSubmitVerificationMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => submitVerificationRequest(auth.transport, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.verification() })
    },
  })
}

// --- Moderator/admin: verification queue ---

export function usePendingVerificationQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.pendingVerification(),
    queryFn: () => listPendingVerification(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useReviewVerificationMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewVerificationInput }) =>
      reviewVerification(auth.transport, id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.pendingVerification() })
    },
  })
}

// --- Vendor/admin: billing (invoices, featured, add-ons) ---

export function useInvoicesQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.invoices(),
    queryFn: () => listInvoices(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useCreateFeaturedPlacementMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFeaturedPlacementInput) => createFeaturedPlacement(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.invoices() })
    },
  })
}

export function useActivateAddOnMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ActivateAddOnInput) => activateAddOn(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.invoices() })
    },
  })
}

// --- Admin: confirmations (subscription / lead / featured / add-on) ---

export function useConfirmSubscriptionInvoiceMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, paymentReference }: { invoiceId: string; paymentReference?: string }) =>
      confirmSubscriptionInvoice(auth.transport, invoiceId, paymentReference),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.subscription() }),
        queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.subscriptionInvoices() }),
        queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.invoices() }),
      ])
    },
  })
}

export function useConfirmLeadPurchaseMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, paymentReference }: { invoiceId: string; paymentReference?: string }) =>
      confirmLeadPurchase(auth.transport, invoiceId, paymentReference),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.session })
    },
  })
}

export function useConfirmFeaturedMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => confirmFeatured(auth.transport, invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.invoices() })
    },
  })
}

export function useConfirmAddOnMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => confirmAddOn(auth.transport, invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.invoices() })
    },
  })
}

// --- Broker: fees + stats ---

export function useBrokerFeesQuery(query: BrokerFeesQuery) {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.brokerFees(query),
    queryFn: () => listBrokerFees(auth.transport, query),
    enabled: auth.isAuthenticated,
  })
}

export function useBrokerStatsQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: monetizationQueryKeys.brokerStats(),
    queryFn: () => getBrokerStats(auth.transport),
    enabled: auth.isAuthenticated,
  })
}

export function useInvoiceBrokerFeeMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feeId: string) => invoiceBrokerFee(auth.transport, feeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...monetizationQueryKeys.session, 'broker-fees'] }),
        queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.brokerStats() }),
      ])
    },
  })
}

export function useConfirmBrokerFeePaymentMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feeId: string) => confirmBrokerFeePayment(auth.transport, feeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...monetizationQueryKeys.session, 'broker-fees'] }),
        queryClient.invalidateQueries({ queryKey: monetizationQueryKeys.brokerStats() }),
      ])
    },
  })
}
