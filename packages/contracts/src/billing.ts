import { z } from 'zod'
import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from './marketplace'

/**
 * Monetization contracts (ПромМаркет).
 *
 * Six offline-billed monetization models, all settled through a shared Invoice:
 *   1. Subscriptions     — SubscriptionPlan + VendorSubscription
 *   2. Lead credits      — LeadCreditLedger (balance = SUM(delta))
 *   3. Featured listings — FeaturedPlacement
 *   4. Verification      — VerificationRequest + VerificationDocument
 *   5. Broker success-fee— BrokerFeeLedger
 *   6. SaaS add-ons      — VendorAddOn
 *
 * No online card payments: vendors pay by bank transfer against an issued
 * invoice, and an admin manually confirms receipt. Money crosses the wire as
 * decimal strings (see decimalStringSchema in marketplace.ts, re-exported below
 * for convenience).
 *
 * Conventions follow the rest of this package: enums are `z.enum`, response
 * objects are `.strict()`, and types are exported via `z.infer`.
 */

// ---------------------------------------------------------------------------
// SHARED PRIMITIVES
// ---------------------------------------------------------------------------

/** ISO-8601 datetime string. */
const datetimeSchema = z.string().datetime()

/**
 * Decimal values cross the wire as strings to preserve precision. Mirrors the
 * marketplace contract; duplicated here so billing consumers do not need to
 * reach into marketplace.ts for a primitive.
 */
export const decimalStringSchema = z
  .string()
  .min(1)
  .regex(/^-?\d+(\.\d+)?$/, 'Decimal strings must be numeric')

export {
  paginationQuerySchema,
  paginatedResponseSchema,
}

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const verificationTierSchema = z.enum(['none', 'basic', 'pro'])

export const subscriptionPeriodSchema = z.enum(['monthly', 'quarterly', 'yearly'])

export const vendorSubscriptionStatusSchema = z.enum([
  'pending_payment',
  'active',
  'past_due',
  'cancelled',
  'expired',
])

export const invoiceTypeSchema = z.enum([
  'subscription',
  'lead_credits',
  'featured',
  'broker_fee',
  'add_on',
])

export const invoicePayerTypeSchema = z.enum(['vendor', 'broker'])

export const invoiceStatusSchema = z.enum([
  'draft',
  'issued',
  'paid',
  'overdue',
  'cancelled',
])

export const leadCreditReasonSchema = z.enum([
  'purchase',
  'admin_grant',
  'rfq_unlock',
  'monthly_reset',
  'refund',
  'subscription_grant',
])

export const featuredSurfaceSchema = z.enum([
  'category_top',
  'home_featured',
  'search_boost',
])

export const featuredStatusSchema = z.enum([
  'pending',
  'active',
  'expired',
  'cancelled',
])

export const verificationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'revoked',
])

export const verificationDocumentTypeSchema = z.enum([
  'inn',
  'ogrn',
  'license',
  'iso_certificate',
  'company_registration',
  'other',
])

export const brokerFeeStatusSchema = z.enum([
  'accrued',
  'invoiced',
  'paid',
  'written_off',
])

export const vendorAddOnFeatureSchema = z.enum([
  'crm',
  'analytics',
  'api_access',
  'tenders',
])

export const vendorAddOnStatusSchema = z.enum([
  'pending',
  'active',
  'disabled',
  'expired',
])

// ---------------------------------------------------------------------------
// 1. SUBSCRIPTIONS
// ---------------------------------------------------------------------------

export const subscriptionPlanSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    price: decimalStringSchema,
    currency: z.string(),
    billingPeriod: subscriptionPeriodSchema,
    maxProducts: z.number().int().nullable(),
    maxRegions: z.number().int().nullable(),
    includedLeadCredits: z.number().int(),
    hasFeatured: z.boolean(),
    hasPrioritySupport: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
  })
  .strict()

export const vendorSubscriptionSchema = z
  .object({
    id: z.uuid(),
    vendorId: z.uuid(),
    planId: z.uuid(),
    status: vendorSubscriptionStatusSchema,
    periodStart: datetimeSchema,
    periodEnd: datetimeSchema.nullable(),
    amount: decimalStringSchema,
    currency: z.string(),
    invoiceId: z.uuid().nullable(),
    confirmedAt: datetimeSchema.nullable(),
    createdAt: datetimeSchema,
    plan: subscriptionPlanSchema.optional(),
  })
  .strict()

export const createSubscriptionInputSchema = z
  .object({
    planId: z.uuid(),
  })
  .strict()

// ---------------------------------------------------------------------------
// 2. LEAD CREDITS
// ---------------------------------------------------------------------------

export const leadCreditLedgerEntrySchema = z
  .object({
    id: z.uuid(),
    vendorId: z.uuid(),
    delta: z.number().int(),
    reason: leadCreditReasonSchema,
    referenceId: z.string().nullable(),
    balanceAfter: z.number().int(),
    createdAt: datetimeSchema,
  })
  .strict()

export const leadCreditBalanceSchema = z
  .object({
    vendorId: z.uuid(),
    balance: z.number().int(),
  })
  .strict()

export const purchaseLeadCreditsInputSchema = z
  .object({
    /** Number of credits to purchase. */
    credits: z.number().int().min(1).max(10000),
    /** Optional payment reference the payer will use in the bank transfer. */
    paymentReference: z.string().trim().max(200).optional(),
  })
  .strict()

export const unlockLeadInputSchema = z
  .object({
    /** The RFQ / deal id whose contacts are being unlocked. */
    referenceId: z.uuid(),
  })
  .strict()

/** Per-credit price is a backend config constant; this is what the client pays. */
export const leadCreditPriceSchema = z
  .object({
    pricePerCredit: decimalStringSchema,
    currency: z.string(),
    /** Optional volume tiers, e.g. { minCredits: 100, pricePerCredit: '...' }. */
    tiers: z
      .array(
        z
          .object({
            minCredits: z.number().int(),
            pricePerCredit: decimalStringSchema,
          })
          .strict(),
      )
      .default([]),
  })
  .strict()

// ---------------------------------------------------------------------------
// 3. FEATURED PLACEMENTS
// ---------------------------------------------------------------------------

export const featuredPlacementSchema = z
  .object({
    id: z.uuid(),
    productId: z.uuid(),
    vendorId: z.uuid(),
    placement: featuredSurfaceSchema,
    startAt: datetimeSchema,
    endAt: datetimeSchema,
    status: featuredStatusSchema,
    invoiceId: z.uuid().nullable(),
    createdAt: datetimeSchema,
  })
  .strict()

export const createFeaturedPlacementInputSchema = z
  .object({
    productId: z.uuid(),
    placement: featuredSurfaceSchema,
    /** Number of days the placement runs. Maps to startAt..endAt on the server. */
    durationDays: z.number().int().min(1).max(365),
  })
  .strict()

// ---------------------------------------------------------------------------
// 4. VERIFICATION
// ---------------------------------------------------------------------------

export const verificationDocumentSchema = z
  .object({
    id: z.uuid(),
    documentType: verificationDocumentTypeSchema,
    fileName: z.string(),
    objectKey: z.string(),
    contentType: z.string(),
    byteSize: z.number().int(),
    uploadedAt: datetimeSchema,
  })
  .strict()

export const verificationRequestSchema = z
  .object({
    id: z.uuid(),
    vendorId: z.uuid(),
    status: verificationStatusSchema,
    requestedTier: verificationTierSchema,
    contactName: z.string().nullable(),
    contactPhone: z.string().nullable(),
    message: z.string().nullable(),
    submittedAt: datetimeSchema.nullable(),
    reviewedAt: datetimeSchema.nullable(),
    reviewerNotes: z.string().nullable(),
    expiresAt: datetimeSchema.nullable(),
    documents: z.array(verificationDocumentSchema).default([]),
    createdAt: datetimeSchema,
    updatedAt: datetimeSchema,
  })
  .strict()

export const createVerificationRequestInputSchema = z
  .object({
    requestedTier: z.enum(['basic', 'pro']),
    contactName: z.string().trim().min(1).max(200),
    contactPhone: z.string().trim().max(50).optional(),
    message: z.string().trim().max(2000).optional(),
    /** Storage object keys of already-uploaded documents. */
    documents: z
      .array(
        z
          .object({
            documentType: verificationDocumentTypeSchema,
            fileName: z.string().min(1).max(255),
            objectKey: z.string().min(1).max(512),
            contentType: z.string().min(1).max(100),
            byteSize: z.number().int().min(1).max(20_000_000),
          })
          .strict(),
      )
      .min(1, 'At least one document is required')
      .max(20),
  })
  .strict()

export const reviewVerificationInputSchema = z
  .object({
    /** Approve or reject. */
    decision: z.enum(['approved', 'rejected']),
    /** Required on rejection; optional on approval. */
    reviewerNotes: z.string().trim().max(2000).optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// 5. INVOICES (shared)
// ---------------------------------------------------------------------------

export const invoiceLineItemSchema = z
  .object({
    description: z.string(),
    quantity: z.number().int().default(1),
    unitPrice: decimalStringSchema,
    total: decimalStringSchema,
  })
  .strict()

export const invoiceSchema = z
  .object({
    id: z.uuid(),
    number: z.string(),
    type: invoiceTypeSchema,
    payerType: invoicePayerTypeSchema,
    payerUserId: z.uuid(),
    vendorId: z.uuid().nullable(),
    subscriptionId: z.uuid().nullable(),
    dealId: z.uuid().nullable(),
    amount: decimalStringSchema,
    currency: z.string(),
    status: invoiceStatusSchema,
    dueDate: datetimeSchema.nullable(),
    issuedAt: datetimeSchema.nullable(),
    paidAt: datetimeSchema.nullable(),
    paymentReference: z.string().nullable(),
    confirmedAt: datetimeSchema.nullable(),
    notes: z.string().nullable(),
    items: z.array(invoiceLineItemSchema),
    createdAt: datetimeSchema,
  })
  .strict()

export const invoicesQuerySchema = paginationQuerySchema
  .extend({
    status: z.array(invoiceStatusSchema).optional(),
    type: z.array(invoiceTypeSchema).optional(),
  })
  .strict()

export const confirmInvoiceInputSchema = z
  .object({
    /** Payment order / bank reference the payer supplied. */
    paymentReference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// 6. BROKER SUCCESS-FEE
// ---------------------------------------------------------------------------

export const brokerFeeLedgerEntrySchema = z
  .object({
    id: z.uuid(),
    dealId: z.uuid(),
    brokerId: z.uuid(),
    baseAmount: decimalStringSchema,
    feePercent: decimalStringSchema,
    feeAmount: decimalStringSchema,
    status: brokerFeeStatusSchema,
    invoiceId: z.uuid().nullable(),
    accruedAt: datetimeSchema,
    paidAt: datetimeSchema.nullable(),
    notes: z.string().nullable(),
    createdAt: datetimeSchema,
  })
  .strict()

export const brokerFeeStatsSchema = z
  .object({
    accruedTotal: decimalStringSchema,
    invoicedTotal: decimalStringSchema,
    paidTotal: decimalStringSchema,
    outstandingTotal: decimalStringSchema,
    count: z.number().int(),
  })
  .strict()

export const brokerFeesQuerySchema = paginationQuerySchema
  .extend({
    status: z.array(brokerFeeStatusSchema).optional(),
  })
  .strict()

/** Backend-configured commission percent applied on deal completion. */
export const brokerFeeConfigSchema = z
  .object({
    defaultFeePercent: decimalStringSchema,
    currency: z.string(),
  })
  .strict()

// ---------------------------------------------------------------------------
// 7. SaaS ADD-ONS
// ---------------------------------------------------------------------------

export const vendorAddOnSchema = z
  .object({
    id: z.uuid(),
    vendorId: z.uuid(),
    feature: vendorAddOnFeatureSchema,
    status: vendorAddOnStatusSchema,
    activatedAt: datetimeSchema.nullable(),
    expiresAt: datetimeSchema.nullable(),
    invoiceId: z.uuid().nullable(),
    createdAt: datetimeSchema,
  })
  .strict()

export const activateAddOnInputSchema = z
  .object({
    feature: vendorAddOnFeatureSchema,
    /** Optional period in days; null means until cancelled. */
    durationDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type VerificationTier = z.infer<typeof verificationTierSchema>
export type SubscriptionPeriod = z.infer<typeof subscriptionPeriodSchema>
export type VendorSubscriptionStatus = z.infer<typeof vendorSubscriptionStatusSchema>
export type InvoiceType = z.infer<typeof invoiceTypeSchema>
export type InvoicePayerType = z.infer<typeof invoicePayerTypeSchema>
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>
export type LeadCreditReason = z.infer<typeof leadCreditReasonSchema>
export type FeaturedSurface = z.infer<typeof featuredSurfaceSchema>
export type FeaturedStatus = z.infer<typeof featuredStatusSchema>
export type VerificationStatus = z.infer<typeof verificationStatusSchema>
export type VerificationDocumentType = z.infer<typeof verificationDocumentTypeSchema>
export type BrokerFeeStatus = z.infer<typeof brokerFeeStatusSchema>
export type VendorAddOnFeature = z.infer<typeof vendorAddOnFeatureSchema>
export type VendorAddOnStatus = z.infer<typeof vendorAddOnStatusSchema>

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>
export type VendorSubscription = z.infer<typeof vendorSubscriptionSchema>
export type LeadCreditLedgerEntry = z.infer<typeof leadCreditLedgerEntrySchema>
export type LeadCreditBalance = z.infer<typeof leadCreditBalanceSchema>
export type FeaturedPlacement = z.infer<typeof featuredPlacementSchema>
export type VerificationRequest = z.infer<typeof verificationRequestSchema>
export type VerificationDocument = z.infer<typeof verificationDocumentSchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>
export type BrokerFeeLedgerEntry = z.infer<typeof brokerFeeLedgerEntrySchema>
export type BrokerFeeStats = z.infer<typeof brokerFeeStatsSchema>
export type VendorAddOn = z.infer<typeof vendorAddOnSchema>
export type LeadCreditPrice = z.infer<typeof leadCreditPriceSchema>
export type BrokerFeeConfig = z.infer<typeof brokerFeeConfigSchema>

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>
export type PurchaseLeadCreditsInput = z.infer<typeof purchaseLeadCreditsInputSchema>
export type UnlockLeadInput = z.infer<typeof unlockLeadInputSchema>
export type CreateFeaturedPlacementInput = z.infer<typeof createFeaturedPlacementInputSchema>
export type CreateVerificationRequestInput = z.infer<typeof createVerificationRequestInputSchema>
export type ReviewVerificationInput = z.infer<typeof reviewVerificationInputSchema>
export type ConfirmInvoiceInput = z.infer<typeof confirmInvoiceInputSchema>
export type ActivateAddOnInput = z.infer<typeof activateAddOnInputSchema>
export type InvoicesQuery = z.infer<typeof invoicesQuerySchema>
export type BrokerFeesQuery = z.infer<typeof brokerFeesQuerySchema>
