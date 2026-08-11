import { z } from 'zod'

/**
 * Marketplace contracts (ПромМаркет port).
 *
 * These mirror the Prisma models added in the `marketplace_foundation` migration.
 * They are the single source of truth for the wire shape between the Hono backend
 * and the React webapp: the backend validates requests and shapes responses with
 * these schemas, and the webapp parses responses against them.
 *
 * Conventions follow the rest of this package: enums are `z.enum`, response objects
 * are `.strict()`, and types are exported via `z.infer`.
 */

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const attributeTypeSchema = z.enum([
  'text',
  'number',
  'number_range',
  'select',
  'multi_select',
  'boolean',
  'file',
  'dimensions',
])

export const productStatusSchema = z.enum([
  'new',
  'used',
  'refurbished',
  'spare_parts',
  'storage',
])

export const productAvailabilitySchema = z.enum(['in_stock', 'on_order'])

export const priceTypeSchema = z.enum(['fixed', 'on_request', 'volume'])

export const dealTypeSchema = z.enum([
  'rfq',
  'specification',
  'price_proposal',
  'procurement',
])

export const dealStatusSchema = z.enum([
  'new',
  'verification',
  'negotiation',
  'proposal',
  'connection',
  'completed',
  'cancelled',
])

export const messageRoleSchema = z.enum(['broker', 'vendor', 'buyer'])

/** Verification tier granted to a vendor by an approved VerificationRequest. */
export const verificationTierSchema = z.enum(['none', 'basic', 'pro'])

// ---------------------------------------------------------------------------
// SHARED PRIMITIVES
// ---------------------------------------------------------------------------

/** ISO-8601 datetime string, as emitted by `new Date().toISOString()` / JSON serialization. */
const datetimeSchema = z.string().datetime()

/**
 * Decimal values cross the wire as strings to preserve precision (JavaScript numbers are
 * floats and cannot represent currency exactly). The Prisma `Decimal` column is serialized
 * this way in the DTO mappers.
 */
const decimalStringSchema = z
  .string()
  .min(1)
  .regex(/^-?\d+(\.\d+)?$/, 'Decimal strings must be numeric')

/** EAV attribute value. Shape depends on the owning Attribute.type. */
const attributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
  z.object({ min: z.number().nullable(), max: z.number().nullable() }),
  z.object({ l: z.number(), w: z.number(), h: z.number() }),
])

// ---------------------------------------------------------------------------
// CATEGORY (tree)
// ---------------------------------------------------------------------------

export const categorySchema: z.ZodType<{
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  order: number
  icon: string | null
  image: string | null
  productCount: number
  children: Category[]
}> = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    parentId: z.uuid().nullable(),
    order: z.number().int(),
    icon: z.string().nullable(),
    image: z.string().nullable(),
    productCount: z.number().int(),
    children: z.lazy(() => z.array(categorySchema)).default([]),
  })
  .strict()

export const flatCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    parentId: z.uuid().nullable(),
    order: z.number().int(),
    icon: z.string().nullable(),
    image: z.string().nullable(),
    productCount: z.number().int(),
  })
  .strict()

// ---------------------------------------------------------------------------
// ATTRIBUTE (EAV definition)
// ---------------------------------------------------------------------------

export const attributeSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    type: attributeTypeSchema,
    unit: z.string().nullable(),
    /** JSON array of option strings for select / multi_select; null otherwise. */
    options: z.array(z.string()).nullable(),
    isFilterable: z.boolean(),
    isRequired: z.boolean(),
    order: z.number().int(),
  })
  .strict()

// ---------------------------------------------------------------------------
// PRODUCT
// ---------------------------------------------------------------------------

export const productImageSchema = z
  .object({
    id: z.uuid(),
    url: z.string(),
    alt: z.string().nullable(),
    order: z.number().int(),
    isPrimary: z.boolean(),
  })
  .strict()

export const productPriceSchema = z
  .object({
    id: z.uuid(),
    type: priceTypeSchema,
    /** Null when type is `on_request`. Decimal as string for precision. */
    price: decimalStringSchema.nullable(),
    currency: z.string(),
    includesVat: z.boolean(),
    vatRate: z.number().int(),
    volumeFrom: z.number().int().nullable(),
    volumeTo: z.number().int().nullable(),
  })
  .strict()

export const productAttributeSchema = z
  .object({
    id: z.uuid(),
    attributeId: z.uuid(),
    attributeSlug: z.string(),
    attributeName: z.string(),
    value: attributeValueSchema,
  })
  .strict()

/** List/card view — no heavy relations. Used by catalog and search. */
export const productListItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    sku: z.string().nullable(),
    brand: z.string().nullable(),
    status: productStatusSchema,
    availability: productAvailabilitySchema,
    /** The FIXED price, or null when only on_request pricing exists. */
    mainPrice: decimalStringSchema.nullable(),
    currency: z.string(),
    /** Best volume discount as a percentage (0–100), or null when no volume tiers. */
    volumeDiscountPercent: z.number().int().nullable(),
    primaryImage: productImageSchema.nullable(),
    vendorId: z.uuid(),
    vendorName: z.string(),
    vendorVerified: z.boolean(),
    /** Verification tier: 'none' | 'basic' | 'pro'. Drives the badge variant. */
    vendorVerificationTier: verificationTierSchema,
    categoryId: z.uuid(),
    views: z.number().int(),
    createdAt: datetimeSchema,
  })
  .strict()

/** Full detail view — images, all prices, EAV attributes, vendor block. */
export const productDetailSchema = productListItemSchema
  .extend({
    description: z.string().nullable(),
    oemNumber: z.string().nullable(),
    model: z.string().nullable(),
    year: z.number().int().nullable(),
    leadTime: z.string().nullable(),
    conditionNote: z.string().nullable(),
    images: z.array(productImageSchema),
    prices: z.array(productPriceSchema),
    attributes: z.array(productAttributeSchema),
    vendorDescription: z.string().nullable(),
    vendorRating: z.number(),
    vendorTotalDeals: z.number().int(),
    updatedAt: datetimeSchema,
  })
  .strict()

// ---------------------------------------------------------------------------
// VENDOR / BUYER
// ---------------------------------------------------------------------------

export const vendorSummarySchema = z
  .object({
    id: z.uuid(),
    companyName: z.string(),
    inn: z.string(),
    verified: z.boolean(),
    rating: z.number(),
    totalDeals: z.number().int(),
    city: z.string().nullable(),
    logo: z.string().nullable(),
    productCount: z.number().int(),
  })
  .strict()

export const buyerSchema = z
  .object({
    id: z.uuid(),
    companyName: z.string(),
    inn: z.string(),
    contactName: z.string().nullable(),
    contactEmail: z.string(),
    contactPhone: z.string().nullable(),
    city: z.string().nullable(),
  })
  .strict()

// ---------------------------------------------------------------------------
// DEAL
// ---------------------------------------------------------------------------

export const dealMessageSchema = z
  .object({
    id: z.uuid(),
    dealId: z.uuid(),
    senderId: z.uuid(),
    senderRole: messageRoleSchema,
    content: z.string(),
    createdAt: datetimeSchema,
  })
  .strict()

export const dealHistoryEntrySchema = z
  .object({
    id: z.uuid(),
    dealId: z.uuid(),
    action: z.string(),
    userId: z.uuid().nullable(),
    details: z.string().nullable(),
    createdAt: datetimeSchema,
  })
  .strict()

export const dealListItemSchema = z
  .object({
    id: z.uuid(),
    dealNumber: z.string(),
    type: dealTypeSchema,
    status: dealStatusSchema,
    title: z.string(),
    productId: z.uuid().nullable(),
    productTitle: z.string().nullable(),
    buyerId: z.uuid().nullable(),
    buyerName: z.string().nullable(),
    vendorId: z.uuid().nullable(),
    vendorName: z.string().nullable(),
    brokerId: z.uuid().nullable(),
    quantity: z.number().int().nullable(),
    totalAmount: decimalStringSchema.nullable(),
    currency: z.string(),
    commission: decimalStringSchema.nullable(),
    createdAt: datetimeSchema,
    updatedAt: datetimeSchema,
  })
  .strict()

export const dealDetailSchema = dealListItemSchema
  .extend({
    description: z.string().nullable(),
    deliveryDate: datetimeSchema.nullable(),
    deliveryAddress: z.string().nullable(),
    notes: z.string().nullable(),
    messages: z.array(dealMessageSchema),
    history: z.array(dealHistoryEntrySchema),
  })
  .strict()

// ---------------------------------------------------------------------------
// DEAL STATE MACHINE
//
// The server enforces this graph; PATCH /api/deals/:id/status rejects any
// transition not listed here. Kept in the contract so the frontend can render
// the available next states without duplicating the rule.
// ---------------------------------------------------------------------------

/**
 * Directed graph of allowed deal status transitions. `completed` and `cancelled`
 * are terminal (empty arrays). Both the backend PATCH handler and the frontend
 * Kanban read from this map so the rule lives in exactly one place.
 */
export const DEAL_STATUS_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  new: ['verification'],
  verification: ['negotiation', 'cancelled'],
  negotiation: ['proposal', 'cancelled'],
  proposal: ['connection', 'negotiation', 'cancelled'],
  connection: ['completed', 'negotiation'],
  completed: [],
  cancelled: [],
}

export function getNextDealStatuses(current: DealStatus): DealStatus[] {
  return DEAL_STATUS_TRANSITIONS[current]
}

export function isDealStatusTransitionAllowed(
  from: DealStatus,
  to: DealStatus,
): boolean {
  return DEAL_STATUS_TRANSITIONS[from].includes(to)
}

export const terminalDealStatuses: DealStatus[] = ['completed', 'cancelled']

// ---------------------------------------------------------------------------
// DEAL INPUT SCHEMAS (RFQ creation, status change, messages)
// ---------------------------------------------------------------------------

export const createDealInputSchema = z
  .object({
    type: dealTypeSchema.default('rfq'),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    productId: z.uuid().optional(),
    vendorId: z.uuid().optional(),
    quantity: z.number().int().min(1).optional(),
    deliveryDate: z.string().datetime().optional(),
    deliveryAddress: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()

export const changeDealStatusInputSchema = z
  .object({
    status: dealStatusSchema,
    notes: z.string().trim().max(1000).optional(),
  })
  .strict()

export const createDealMessageInputSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict()

export type CreateDealInput = z.infer<typeof createDealInputSchema>
export type ChangeDealStatusInput = z.infer<typeof changeDealStatusInputSchema>
export type CreateDealMessageInput = z.infer<typeof createDealMessageInputSchema>

// ---------------------------------------------------------------------------
// QUERY / PAGINATION (used by catalog endpoints in iteration 2)
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict()

export const dealsQuerySchema = paginationQuerySchema
  .extend({
    status: z.array(dealStatusSchema).optional(),
    type: z.array(dealTypeSchema).optional(),
    vendorId: z.uuid().optional(),
    buyerId: z.uuid().optional(),
    brokerId: z.uuid().optional(),
  })
  .strict()

export type DealsQuery = z.infer<typeof dealsQuerySchema>

export const productSortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'title',
  'views',
  'price',
  'brand',
])

export const sortDirectionSchema = z.enum(['asc', 'desc'])

export const productsQuerySchema = paginationQuerySchema
  .extend({
    categoryId: z.uuid().optional(),
    status: z.array(productStatusSchema).optional(),
    availability: z.array(productAvailabilitySchema).optional(),
    vendorId: z.uuid().optional(),
    search: z.string().trim().max(200).optional(),
    priceMin: z.coerce.number().nonnegative().optional(),
    priceMax: z.coerce.number().nonnegative().optional(),
    /** EAV attribute filters, keyed by attribute slug. */
    attributes: z.record(z.string(), z.array(z.string())).optional(),
    sortBy: productSortFieldSchema.default('createdAt'),
    sortDir: sortDirectionSchema.default('desc'),
  })
  .strict()

export const paginatedResponseMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict()

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema),
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    })
    .strict()
}

// ---------------------------------------------------------------------------
// SEARCH (unified product + category matching)
// ---------------------------------------------------------------------------

export const searchQuerySchema = paginationQuerySchema
  .extend({
    query: z.string().trim().min(1).max(200),
    categoryId: z.uuid().optional(),
  })
  .strict()

/** Compact product hit for the search dropdown and results page. */
export const searchProductHitSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: z.string(),
    mainPrice: decimalStringSchema.nullable(),
    currency: z.string(),
    status: productStatusSchema,
    primaryImage: productImageSchema.nullable(),
    vendorName: z.string(),
  })
  .strict()

export const searchCategoryHitSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    productCount: z.number().int(),
  })
  .strict()

export const searchResultSchema = z
  .object({
    query: z.string(),
    products: z.array(searchProductHitSchema),
    categories: z.array(searchCategoryHitSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict()

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type AttributeType = z.infer<typeof attributeTypeSchema>
export type ProductStatus = z.infer<typeof productStatusSchema>
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>
export type PriceType = z.infer<typeof priceTypeSchema>
export type DealType = z.infer<typeof dealTypeSchema>
export type DealStatus = z.infer<typeof dealStatusSchema>
export type MessageRole = z.infer<typeof messageRoleSchema>

export type Category = z.infer<typeof categorySchema>
export type FlatCategory = z.infer<typeof flatCategorySchema>
export type Attribute = z.infer<typeof attributeSchema>
export type ProductImage = z.infer<typeof productImageSchema>
export type ProductPrice = z.infer<typeof productPriceSchema>
export type ProductAttribute = z.infer<typeof productAttributeSchema>
export type ProductListItem = z.infer<typeof productListItemSchema>
export type ProductDetail = z.infer<typeof productDetailSchema>
export type VendorSummary = z.infer<typeof vendorSummarySchema>
export type Buyer = z.infer<typeof buyerSchema>
export type DealMessage = z.infer<typeof dealMessageSchema>
export type DealHistoryEntry = z.infer<typeof dealHistoryEntrySchema>
export type DealListItem = z.infer<typeof dealListItemSchema>
export type Deal = DealListItem
export type DealDetail = z.infer<typeof dealDetailSchema>
export type ProductsQuery = z.infer<typeof productsQuerySchema>
export type ProductSortField = z.infer<typeof productSortFieldSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>
export type PaginatedResponseMeta = z.infer<typeof paginatedResponseMetaSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchProductHit = z.infer<typeof searchProductHitSchema>
export type SearchCategoryHit = z.infer<typeof searchCategoryHitSchema>
export type SearchResult = z.infer<typeof searchResultSchema>

// ---------------------------------------------------------------------------
// VENDOR PRODUCT MANAGEMENT (iteration 6)
// ---------------------------------------------------------------------------

export const createProductInputSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    slug: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(10000).optional(),
    sku: z.string().trim().max(100).optional(),
    oemNumber: z.string().trim().max(100).optional(),
    brand: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    status: productStatusSchema.default('new'),
    availability: productAvailabilitySchema.default('in_stock'),
    leadTime: z.string().trim().max(100).optional(),
    conditionNote: z.string().trim().max(2000).optional(),
    categoryId: z.uuid(),
    images: z
      .array(
        z
          .object({
            url: z.string().trim().min(1).max(1000),
            alt: z.string().trim().max(200).optional(),
            order: z.number().int().default(0),
            isPrimary: z.boolean().default(false),
          })
          .strict(),
      )
      .default([]),
    attributes: z
      .array(
        z
          .object({
            attributeId: z.uuid(),
            value: attributeValueSchema,
          })
          .strict(),
      )
      .default([]),
    prices: z
      .array(
        z
          .object({
            type: priceTypeSchema.default('fixed'),
            price: decimalStringSchema.nullable().default(null),
            currency: z.string().default('RUB'),
            includesVat: z.boolean().default(true),
            vatRate: z.number().int().min(0).max(100).default(20),
            volumeFrom: z.number().int().min(1).optional(),
            volumeTo: z.number().int().min(1).optional(),
          })
          .strict(),
      )
      .min(1, 'At least one price row is required'),
  })
  .strict()

export const updateProductInputSchema = createProductInputSchema.partial()

// ---------------------------------------------------------------------------
// ADMIN CATEGORY / ATTRIBUTE MANAGEMENT (iteration 6)
// ---------------------------------------------------------------------------

export const createCategoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    parentId: z.uuid().optional(),
    order: z.number().int().default(0),
    icon: z.string().trim().max(50).optional(),
    image: z.string().trim().max(1000).optional(),
  })
  .strict()

export const updateCategoryInputSchema = createCategoryInputSchema.partial()

export const createAttributeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    type: attributeTypeSchema.default('text'),
    unit: z.string().trim().max(50).optional(),
    options: z.array(z.string()).optional(),
    isFilterable: z.boolean().default(false),
    isRequired: z.boolean().default(false),
    order: z.number().int().default(0),
    categoryIds: z.array(z.uuid()).default([]),
  })
  .strict()

export type CreateProductInput = z.infer<typeof createProductInputSchema>
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
export type CreateAttributeInput = z.infer<typeof createAttributeInputSchema>

// ---------------------------------------------------------------------------
// REVIEWS (iteration 7)
// ---------------------------------------------------------------------------

export const productReviewSchema = z
  .object({
    id: z.uuid(),
    productId: z.uuid(),
    authorId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().nullable(),
    body: z.string().nullable(),
    vendorReply: z.string().nullable(),
    createdAt: datetimeSchema,
    updatedAt: datetimeSchema,
  })
  .strict()

export const createReviewInputSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().max(5000).optional(),
  })
  .strict()

export const reviewVendorReplyInputSchema = z
  .object({
    reply: z.string().trim().min(1).max(2000),
  })
  .strict()

export type ProductReview = z.infer<typeof productReviewSchema>
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>
export type ReviewVendorReplyInput = z.infer<typeof reviewVendorReplyInputSchema>
