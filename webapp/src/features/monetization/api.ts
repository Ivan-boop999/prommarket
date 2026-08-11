import {
  brokerFeeLedgerEntrySchema,
  brokerFeeStatsSchema,
  brokerFeesQuerySchema,
  createFeaturedPlacementInputSchema,
  createSubscriptionInputSchema,
  featuredPlacementSchema,
  invoiceSchema,
  leadCreditBalanceSchema,
  leadCreditLedgerEntrySchema,
  leadCreditPriceSchema,
  purchaseLeadCreditsInputSchema,
  reviewVerificationInputSchema,
  subscriptionPlanSchema,
  vendorAddOnSchema,
  vendorSubscriptionSchema,
  verificationRequestSchema,
  activateAddOnInputSchema,
  createVerificationRequestInputSchema,
  type BrokerFeesQuery,
  type CreateFeaturedPlacementInput,
  type CreateSubscriptionInput,
  type CreateVerificationRequestInput,
  type PurchaseLeadCreditsInput,
  type ReviewVerificationInput,
  type ActivateAddOnInput,
} from '@web-app-demo/contracts'
import { z } from 'zod'

import { publicClient } from '@/platform/api/public-client'
import type { AuthenticatedTransport } from '@/platform/api'

/**
 * Monetization API. Public read endpoints (subscription plans, lead-credit
 * price) go through `publicClient`; everything that acts on a vendor/broker
 * account is authenticated via `transport`.
 */

// --- Subscriptions (public + vendor + admin) ---

export function listSubscriptionPlans() {
  return publicClient.request('/api/subscriptions/plans', z.array(subscriptionPlanSchema))
}

export function getCurrentSubscription(transport: AuthenticatedTransport) {
  return transport.request('/api/subscriptions/me', vendorSubscriptionSchema.nullable())
}

export function subscribe(transport: AuthenticatedTransport, input: CreateSubscriptionInput) {
  return transport.request(
    '/api/subscriptions/subscribe',
    z.object({ subscription: vendorSubscriptionSchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: createSubscriptionInputSchema.parse(input) },
  )
}

export function listSubscriptionInvoices(transport: AuthenticatedTransport) {
  return transport.request('/api/subscriptions/invoices', z.array(invoiceSchema))
}

export function confirmSubscriptionInvoice(
  transport: AuthenticatedTransport,
  invoiceId: string,
  paymentReference?: string,
) {
  return transport.request(
    `/api/subscriptions/invoices/${encodeURIComponent(invoiceId)}/confirm`,
    z.object({ invoice: invoiceSchema, subscription: vendorSubscriptionSchema }).strict(),
    {
      method: 'POST',
      body: { paymentReference },
    },
  )
}

// --- Lead credits (public + vendor + admin) ---

export function getLeadCreditPrice() {
  return publicClient.request('/api/leads/price', leadCreditPriceSchema)
}

export function getLeadCreditBalance(transport: AuthenticatedTransport) {
  return transport.request('/api/leads/balance', leadCreditBalanceSchema)
}

export function getLeadCreditLedger(transport: AuthenticatedTransport) {
  return transport.request('/api/leads/ledger', z.array(leadCreditLedgerEntrySchema))
}

export function purchaseLeadCredits(transport: AuthenticatedTransport, input: PurchaseLeadCreditsInput) {
  return transport.request(
    '/api/leads/purchase',
    z.object({ invoice: invoiceSchema }).strict(),
    { method: 'POST', body: purchaseLeadCreditsInputSchema.parse(input) },
  )
}

export function unlockLead(transport: AuthenticatedTransport, referenceId: string) {
  return transport.request(
    '/api/leads/unlock',
    z
      .object({ ledgerEntry: leadCreditLedgerEntrySchema, balance: z.number().int() })
      .strict(),
    { method: 'POST', body: { referenceId } },
  )
}

export function confirmLeadPurchase(
  transport: AuthenticatedTransport,
  invoiceId: string,
  paymentReference?: string,
) {
  return transport.request(
    `/api/leads/purchase/${encodeURIComponent(invoiceId)}/confirm`,
    z.object({ invoice: invoiceSchema, balance: z.number().int() }).strict(),
    { method: 'POST', body: { paymentReference } },
  )
}

// --- Verification (vendor + moderator) ---

export function createVerificationRequest(
  transport: AuthenticatedTransport,
  input: CreateVerificationRequestInput,
) {
  return transport.request('/api/verification/requests', verificationRequestSchema, {
    method: 'POST',
    body: createVerificationRequestInputSchema.parse(input),
  })
}

export function getMyVerificationRequest(transport: AuthenticatedTransport) {
  return transport.request('/api/verification/me', verificationRequestSchema.nullable())
}

export function submitVerificationRequest(transport: AuthenticatedTransport, id: string) {
  return transport.request(
    `/api/verification/requests/${encodeURIComponent(id)}/submit`,
    verificationRequestSchema,
    { method: 'POST' },
  )
}

export function listPendingVerification(transport: AuthenticatedTransport) {
  return transport.request('/api/verification/pending', z.array(verificationRequestSchema))
}

export function reviewVerification(
  transport: AuthenticatedTransport,
  id: string,
  input: ReviewVerificationInput,
) {
  return transport.request(
    `/api/verification/requests/${encodeURIComponent(id)}/review`,
    verificationRequestSchema,
    { method: 'POST', body: reviewVerificationInputSchema.parse(input) },
  )
}

// --- Billing: featured + add-ons + invoice listing (vendor + admin) ---

export function listInvoices(
  transport: AuthenticatedTransport,
  query?: { status?: string[]; type?: string[] },
) {
  const search = new URLSearchParams()
  for (const s of query?.status ?? []) search.append('status', s)
  for (const t of query?.type ?? []) search.append('type', t)
  const qs = search.toString()
  return transport.request(
    `/api/billing/invoices${qs ? `?${qs}` : ''}`,
    z.array(invoiceSchema),
  )
}

export function createFeaturedPlacement(
  transport: AuthenticatedTransport,
  input: CreateFeaturedPlacementInput,
) {
  return transport.request(
    '/api/billing/featured',
    z.object({ placement: featuredPlacementSchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: createFeaturedPlacementInputSchema.parse(input) },
  )
}

export function confirmFeatured(transport: AuthenticatedTransport, invoiceId: string) {
  return transport.request(
    `/api/billing/featured/${encodeURIComponent(invoiceId)}/confirm`,
    z.object({ placement: featuredPlacementSchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: {} },
  )
}

export function activateAddOn(transport: AuthenticatedTransport, input: ActivateAddOnInput) {
  return transport.request(
    '/api/billing/add-ons',
    z.object({ addOn: vendorAddOnSchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: activateAddOnInputSchema.parse(input) },
  )
}

export function confirmAddOn(transport: AuthenticatedTransport, invoiceId: string) {
  return transport.request(
    `/api/billing/add-ons/${encodeURIComponent(invoiceId)}/confirm`,
    z.object({ addOn: vendorAddOnSchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: {} },
  )
}

// --- Broker fees (broker + admin) ---

export function listBrokerFees(transport: AuthenticatedTransport, query: BrokerFeesQuery) {
  const q = brokerFeesQuerySchema.parse(query)
  const search = new URLSearchParams({
    page: String(q.page),
    pageSize: String(q.pageSize),
  })
  for (const s of q.status ?? []) search.append('status', s)
  return transport.request(
    `/api/broker/fees?${search}`,
    z.object({
      items: z.array(brokerFeeLedgerEntrySchema),
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  )
}

export function getBrokerStats(transport: AuthenticatedTransport) {
  return transport.request('/api/broker/stats', brokerFeeStatsSchema)
}

export function invoiceBrokerFee(transport: AuthenticatedTransport, feeId: string) {
  return transport.request(
    `/api/broker/fees/${encodeURIComponent(feeId)}/invoice`,
    z.object({ fee: brokerFeeLedgerEntrySchema, invoice: invoiceSchema }).strict(),
    { method: 'POST' },
  )
}

export function confirmBrokerFeePayment(transport: AuthenticatedTransport, feeId: string) {
  return transport.request(
    `/api/broker/fees/${encodeURIComponent(feeId)}/confirm-payment`,
    z.object({ fee: brokerFeeLedgerEntrySchema, invoice: invoiceSchema }).strict(),
    { method: 'POST', body: {} },
  )
}
