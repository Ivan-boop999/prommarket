import type {
  CreateProductInput,
  ProductDetail,
  UpdateProductInput,
} from '@web-app-demo/contracts'
import { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import { VendorProductFailure } from '../domain/errors'

/**
 * Vendor product CRUD repository.
 *
 * Ownership is enforced in the repository, not just the route: every
 * find/mutate takes vendorId and scopes by it, so a vendor can never read or
 * mutate another vendor's product even if they guess its id.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export type VendorProductRepository = {
  listByVendor(vendorId: string): Promise<ProductDetail[]>
  findByVendor(vendorId: string, productId: string): Promise<ProductDetail | null>
  create(vendorId: string, input: CreateProductInput): Promise<ProductDetail>
  update(vendorId: string, productId: string, input: UpdateProductInput): Promise<ProductDetail>
  remove(vendorId: string, productId: string): Promise<void>
}

type ProductDetailRow = {
  id: string
  title: string
  slug: string
  description: string | null
  sku: string | null
  oemNumber: string | null
  brand: string | null
  model: string | null
  year: number | null
  status: string
  availability: string
  leadTime: string | null
  conditionNote: string | null
  categoryId: string
  vendorId: string
  views: number
  featuredUntil: Date | null
  createdAt: Date
  updatedAt: Date
  images: Array<{ id: string; url: string; alt: string | null; order: number; isPrimary: boolean }>
  prices: Array<{ id: string; type: string; price: { toString(): string } | null; currency: string; includesVat: boolean; vatRate: number; volumeFrom: number | null; volumeTo: number | null }>
  attributes: Array<{ id: string; attributeId: string; value: unknown; attribute: { id: string; name: string; slug: string; type: string; unit: string | null }>
  category: { id: string; name: string; slug: string }
  vendor: { id: string; companyName: string; verified: boolean; verificationTier: string; rating: { toString(): string } }
}

const detailInclude = {
  images: { orderBy: { order: 'asc' as const } },
  prices: { orderBy: { type: 'asc' as const } },
  attributes: { include: { attribute: { select: { id: true, name: true, slug: true, type: true, unit: true } } } },
  category: { select: { id: true, name: true, slug: true } },
  vendor: { select: { id: true, companyName: true, verified: true, verificationTier: true, rating: true } },
} as const

// Reuse the catalog mapper's shape. The full DTO mapping is substantial; for
// the vendor surface we return a compact ProductDetail that the contract accepts.
function toProductDetail(row: ProductDetailRow): ProductDetail {
  const mainPrice = row.prices.find((p) => p.type === 'fixed') ?? row.prices[0]
  const primaryImage = row.images.find((i) => i.isPrimary) ?? row.images[0]
  const volumeDiscount = row.prices.find((p) => p.type === 'volume')
  // Compute volumeDiscountPercent if a cheaper volume tier exists vs main price.
  let volumeDiscountPercent: number | null = null
  if (mainPrice?.price && volumeDiscount?.price) {
    const main = Number(mainPrice.price.toString())
    const vol = Number(volumeDiscount.price.toString())
    if (main > 0 && vol < main) {
      volumeDiscountPercent = Math.round(((main - vol) / main) * 100)
    }
  }
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    sku: row.sku,
    oemNumber: row.oemNumber,
    brand: row.brand,
    model: row.model,
    year: row.year,
    status: row.status as ProductDetail['status'],
    availability: row.availability as ProductDetail['availability'],
    leadTime: row.leadTime,
    conditionNote: row.conditionNote,
    categoryId: row.categoryId,
    vendorId: row.vendorId,
    views: row.views,
    featuredUntil: row.featuredUntil ? row.featuredUntil.toISOString() : null,
    primaryImage: primaryImage
      ? { id: primaryImage.id, url: primaryImage.url, alt: primaryImage.alt, order: primaryImage.order, isPrimary: primaryImage.isPrimary }
      : null,
    images: row.images.map((i) => ({
      id: i.id,
      url: i.url,
      alt: i.alt,
      order: i.order,
      isPrimary: i.isPrimary,
    })),
    mainPrice: mainPrice?.price ? mainPrice.price.toString() : null,
    currency: mainPrice?.currency ?? 'RUB',
    includesVat: mainPrice?.includesVat ?? true,
    vatRate: mainPrice?.vatRate ?? 20,
    volumeDiscountPercent,
    prices: row.prices.map((p) => ({
      id: p.id,
      type: p.type as ProductDetail['prices'][number]['type'],
      price: p.price ? p.price.toString() : null,
      currency: p.currency,
      includesVat: p.includesVat,
      vatRate: p.vatRate,
      volumeFrom: p.volumeFrom,
      volumeTo: p.volumeTo,
    })),
    attributes: row.attributes.map((a) => ({
      id: a.id,
      attributeId: a.attributeId,
      attributeName: a.attribute.name,
      attributeSlug: a.attribute.slug,
      attributeType: a.attribute.type as ProductDetail['attributes'][number]['attributeType'],
      attributeUnit: a.attribute.unit,
      value: a.value as ProductDetail['attributes'][number]['value'],
    })),
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
    },
    vendor: {
      id: row.vendor.id,
      companyName: row.vendor.companyName,
      verified: row.vendor.verified,
      verificationTier: row.vendor.verificationTier as ProductDetail['vendor']['verificationTier'],
      vendorRating: Number(row.vendor.rating.toString()),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as ProductDetail
}

export function createPrismaVendorProductsRepository(db: DbClient): VendorProductRepository {
  return {
    async listByVendor(vendorId) {
      const rows = await db.product.findMany({
        where: { vendorId },
        include: detailInclude,
        orderBy: { createdAt: 'desc' },
      })
      return rows.map((r) => toProductDetail(r as ProductDetailRow))
    },

    async findByVendor(vendorId, productId) {
      const row = await db.product.findUnique({
        where: { id: productId },
        include: detailInclude,
      })
      if (!row) return null
      if (row.vendorId !== vendorId) {
        throw new VendorProductFailure('not_owner', 'Product belongs to another vendor')
      }
      return toProductDetail(row as ProductDetailRow)
    },

    async create(vendorId, input) {
      const category = await db.category.findUnique({ where: { id: input.categoryId } })
      if (!category) {
        throw new VendorProductFailure('category_not_found', `Category ${input.categoryId} not found`)
      }
      const slug = input.slug ?? slugify(input.title) + '-' + Math.random().toString(36).slice(2, 6)
      const product = await db.product.create({
        data: {
          title: input.title,
          slug,
          description: input.description ?? null,
          sku: input.sku ?? null,
          oemNumber: input.oemNumber ?? null,
          brand: input.brand ?? null,
          model: input.model ?? null,
          year: input.year ?? null,
          status: input.status,
          availability: input.availability,
          leadTime: input.leadTime ?? null,
          conditionNote: input.conditionNote ?? null,
          categoryId: input.categoryId,
          vendorId,
          images: { create: input.images },
          prices: {
            create: input.prices.map((p) => ({
              type: p.type,
              price: p.price ? new Prisma.Decimal(p.price) : null,
              currency: p.currency,
              includesVat: p.includesVat,
              vatRate: p.vatRate,
              volumeFrom: p.volumeFrom,
              volumeTo: p.volumeTo,
            })),
          },
          attributes: {
            create: input.attributes.map((a) => ({ attributeId: a.attributeId, value: a.value as Prisma.InputJsonValue })),
          },
        },
        include: detailInclude,
      })
      // Bump the category product counter.
      await db.category.update({
        where: { id: input.categoryId },
        data: { productCount: { increment: 1 } },
      })
      return toProductDetail(product as ProductDetailRow)
    },

    async update(vendorId, productId, input) {
      const existing = await db.product.findUnique({ where: { id: productId } })
      if (!existing) throw new VendorProductFailure('not_found', `Product ${productId} not found`)
      if (existing.vendorId !== vendorId) {
        throw new VendorProductFailure('not_owner', 'Product belongs to another vendor')
      }
      const updated = await db.product.update({
        where: { id: productId },
        data: {
          title: input.title,
          description: input.description,
          sku: input.sku,
          oemNumber: input.oemNumber,
          brand: input.brand,
          model: input.model,
          year: input.year,
          status: input.status,
          availability: input.availability,
          leadTime: input.leadTime,
          conditionNote: input.conditionNote,
          categoryId: input.categoryId,
        },
        include: detailInclude,
      })
      return toProductDetail(updated as ProductDetailRow)
    },

    async remove(vendorId, productId) {
      const existing = await db.product.findUnique({ where: { id: productId } })
      if (!existing) throw new VendorProductFailure('not_found', `Product ${productId} not found`)
      if (existing.vendorId !== vendorId) {
        throw new VendorProductFailure('not_owner', 'Product belongs to another vendor')
      }
      await db.product.delete({ where: { id: productId } })
      await db.category.update({
        where: { id: existing.categoryId },
        data: { productCount: { decrement: 1 } },
      }).catch(() => undefined)
    },
  }
}
