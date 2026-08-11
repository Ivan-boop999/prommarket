import type {
  ProductDetail,
  ProductListItem,
  ProductsQuery,
  SearchCategoryHit,
  SearchProductHit,
  SearchResult,
} from '@web-app-demo/contracts'
import type { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import type { ProductReader } from '../application/ports'
import { createPrismaCategoriesRepository } from './categories-repository'

/**
 * Products repository.
 *
 * This is where the original ПромМаркет frontend filters move to the server.
 * The original `/api/products` only filtered by one category / one status / a
 * text term, then re-filtered by price, EAV attributes, and subcategory rollup
 * in the browser. Here all of that is one Prisma query:
 *
 *  - `categoryId` rolls up descendants (the `CategoryReader.descendantIds`
 *    helper), so picking a top-level category matches products in children.
 *  - `status` and `availability` accept arrays; multi-select filters work.
 *  - `priceMin` / `priceMax` filter on the FIXED price row, excluding
 *    on_request products (which have no public price).
 *  - `attributes` filters by EAV value via a joined `ProductAttribute` clause
 *    per attribute slug. Each clause is AND-ed, values within a clause OR-ed.
 *  - Sort by `price` traverses into `prices.price` on the FIXED row.
 *
 * The `mainPrice` and `volumeDiscountPercent` on each list item are computed
 * here from the loaded price rows, so the catalog card can render the price
 * badge without a second request.
 */
export function createPrismaProductsRepository(db: DbClient): ProductReader {
  const categories = createPrismaCategoriesRepository(db)

  return {
    async list(query) {
      const where = await buildProductWhere(categories, query)
      const orderBy = buildProductOrderBy(query.sortBy, query.sortDir)
      const [total, rows] = await db.$transaction([
        db.product.count({ where }),
        db.product.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: productListItemInclude,
        }),
      ])
      const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
      return {
        items: rows.map(toProductListItem),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      }
    },

    async findById(id) {
      const row = await db.product.findUnique({
        where: { id },
        include: productDetailInclude,
      })
      return row ? toProductDetail(row) : null
    },

    async findByIdAndBumpViews(id) {
      // Atomic increment + read in one transaction so concurrent visits each
      // bump the counter exactly once. The original did a separate UPDATE that
      // could lose increments under load.
      const row = await db.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: { views: { increment: 1 } } })
        return tx.product.findUnique({ where: { id }, include: productDetailInclude })
      })
      return row ? toProductDetail(row) : null
    },

    async search({ query: term, categoryId, page, pageSize }) {
      const productWhere: Prisma.ProductWhereInput = {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { oemNumber: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
        ],
      }
      if (categoryId) {
        // Rollup: match the chosen category or any descendant.
        const ids = await categories.descendantIds(categoryId)
        productWhere.categoryId = { in: [...ids] }
      }
      const categoryWhere: Prisma.CategoryWhereInput = {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      }
      const [total, productRows, categoryRows] = await Promise.all([
        db.product.count({ where: productWhere }),
        db.product.findMany({
          where: productWhere,
          orderBy: { views: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: productListItemInclude,
        }),
        db.category.findMany({
          where: categoryWhere,
          orderBy: { productCount: 'desc' },
          take: 20,
        }),
      ])
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
      const hits = productRows.map((p): SearchProductHit => {
        const main = fixedPrice(p.prices)
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          mainPrice: main ? main.price.toString() : null,
          currency: main?.currency ?? 'RUB',
          status: p.status,
          primaryImage: primaryImage(p.images),
          vendorName: p.vendor.companyName,
        }
      })
      const categoryHits: SearchCategoryHit[] = categoryRows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c.productCount,
      }))
      return {
        query: term,
        products: hits,
        categories: categoryHits,
        page,
        pageSize,
        total,
        totalPages,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Prisma query fragments
// ---------------------------------------------------------------------------

const productListItemInclude = {
  vendor: { select: { id: true, companyName: true, verified: true } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { order: 'asc' as const }] },
  prices: true,
} satisfies Prisma.ProductInclude

const productDetailInclude = {
  ...productListItemInclude,
  category: { select: { id: true, name: true, slug: true } },
  vendor: {
    select: {
      id: true,
      companyName: true,
      verified: true,
      description: true,
      rating: true,
      totalDeals: true,
    },
  },
  attributes: { include: { attribute: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ProductInclude

// ---------------------------------------------------------------------------
// WHERE / ORDER builders
// ---------------------------------------------------------------------------

async function buildProductWhere(
  categories: ReturnType<typeof createPrismaCategoriesRepository>,
  query: ProductsQuery,
): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = {}

  if (query.categoryId) {
    const ids = await categories.descendantIds(query.categoryId)
    where.categoryId = { in: [...ids] }
  }
  if (query.status && query.status.length > 0) {
    where.status = { in: query.status }
  }
  if (query.availability && query.availability.length > 0) {
    where.availability = { in: query.availability }
  }
  if (query.vendorId) {
    where.vendorId = query.vendorId
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
      { oemNumber: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    where.prices = {
      some: {
        type: 'fixed',
        ...(query.priceMin !== undefined || query.priceMax !== undefined
          ? {
              price: {
                ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
                ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
              },
            }
          : {}),
      },
    }
  }
  if (query.attributes) {
    // Each attribute slug becomes its own AND-ed relation clause; values within
    // a slug are OR-ed. Values are matched as JSON scalars against the `value`
    // Json column, which covers TEXT/SELECT (string) and NUMBER (number).
    const clauses: Prisma.ProductAttributeWhereInput[] = []
    for (const [slug, values] of Object.entries(query.attributes)) {
      if (values.length === 0) continue
      clauses.push({
        attribute: { slug },
        OR: values.map((v) => ({ value: { equals: v } })),
      })
    }
    if (clauses.length > 0) {
      where.AND = clauses.map((clause) => ({ attributes: { some: clause } }))
    }
  }
  return where
}

function buildProductOrderBy(
  sortBy: ProductsQuery['sortBy'],
  sortDir: ProductsQuery['sortDir'],
): Prisma.ProductOrderByWithRelationInput[] {
  const direction = sortDir === 'asc' ? 'asc' : 'desc'
  switch (sortBy) {
    case 'title':
      return [{ title: direction }]
    case 'brand':
      return [{ brand: direction }]
    case 'views':
      return [{ views: direction }]
    case 'updatedAt':
      return [{ updatedAt: direction }]
    case 'price':
      // Prisma 7 relation orderBy only supports _count, not _min/_max on a
      // nested field, so server-side sort by price would need a raw SQL join.
      // Price sort stays a client-side concern for now (matches the original
      // ПромМаркет behavior). Fall back to createdAt so the result is stable.
      return [{ createdAt: direction }, { id: direction }]
    case 'createdAt':
    default:
      return [{ createdAt: direction }, { id: direction }]
  }
}

// ---------------------------------------------------------------------------
// Row → DTO mappers
// ---------------------------------------------------------------------------

type ProductListRow = Prisma.ProductGetPayload<{ include: typeof productListItemInclude }>
type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>

type PriceRow = ProductDetailRow['prices'][number]

function fixedPrice(
  prices: PriceRow[],
): { price: Prisma.Decimal; currency: string; volumeFrom: number | null; volumeTo: number | null } | null {
  const fixed = prices.find((p) => p.type === 'fixed' && p.price !== null)
  if (!fixed || fixed.price === null) return null
  return {
    price: fixed.price,
    currency: fixed.currency,
    volumeFrom: fixed.volumeFrom,
    volumeTo: fixed.volumeTo,
  }
}

function bestVolumeDiscountPercent(prices: PriceRow[]): number | null {
  const fixed = prices.find((p) => p.type === 'fixed' && p.price !== null)
  const volume = prices.filter((p) => p.type === 'volume' && p.price !== null)
  if (!fixed || fixed.price === null || volume.length === 0) return null
  const minVolume = volume.reduce(
    (min, p) => (p.price !== null && p.price.lessThan(min) ? p.price : min),
    fixed.price,
  )
  if (minVolume.greaterThanOrEqualTo(fixed.price)) return null
  return Math.round(fixed.price.minus(minVolume).dividedBy(fixed.price).mul(100).toNumber())
}

function primaryImage(
  images: Prisma.ProductImageGetPayload<{}>[],
): ProductListItem['primaryImage'] {
  const chosen = images.find((i) => i.isPrimary) ?? images[0]
  if (!chosen) return null
  return {
    id: chosen.id,
    url: chosen.url,
    alt: chosen.alt,
    order: chosen.order,
    isPrimary: chosen.isPrimary,
  }
}

function toProductListItem(row: ProductListRow): ProductListItem {
  const main = fixedPrice(row.prices)
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    status: row.status,
    availability: row.availability,
    mainPrice: main ? main.price.toString() : null,
    currency: main?.currency ?? 'RUB',
    volumeDiscountPercent: bestVolumeDiscountPercent(row.prices),
    primaryImage: primaryImage(row.images),
    vendorId: row.vendor.id,
    vendorName: row.vendor.companyName,
    vendorVerified: row.vendor.verified,
    categoryId: row.categoryId,
    views: row.views,
    createdAt: row.createdAt.toISOString(),
  }
}

function toProductDetail(row: ProductDetailRow): ProductDetail {
  const main = fixedPrice(row.prices)
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    status: row.status,
    availability: row.availability,
    mainPrice: main ? main.price.toString() : null,
    currency: main?.currency ?? 'RUB',
    volumeDiscountPercent: bestVolumeDiscountPercent(row.prices),
    primaryImage: primaryImage(row.images),
    vendorId: row.vendor.id,
    vendorName: row.vendor.companyName,
    vendorVerified: row.vendor.verified,
    categoryId: row.category.id,
    views: row.views,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    description: row.description,
    oemNumber: row.oemNumber,
    model: row.model,
    year: row.year,
    leadTime: row.leadTime,
    conditionNote: row.conditionNote,
    images: [...row.images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order)
      .map((img) => ({
        id: img.id,
        url: img.url,
        alt: img.alt,
        order: img.order,
        isPrimary: img.isPrimary,
      })),
    prices: row.prices.map((p) => ({
      id: p.id,
      type: p.type,
      price: p.price ? p.price.toString() : null,
      currency: p.currency,
      includesVat: p.includesVat,
      vatRate: p.vatRate,
      volumeFrom: p.volumeFrom,
      volumeTo: p.volumeTo,
    })),
    attributes: row.attributes.map((pa) => ({
      id: pa.id,
      attributeId: pa.attribute.id,
      attributeSlug: pa.attribute.slug,
      attributeName: pa.attribute.name,
      // Prisma stores this as JsonValue; the shape is governed by Attribute.type
      // at write time and re-validated by productDetailSchema on read.
      value: pa.value as ProductDetail['attributes'][number]['value'],
    })),
    vendorDescription: row.vendor.description,
    vendorRating: Number(row.vendor.rating),
    vendorTotalDeals: row.vendor.totalDeals,
  }
}
