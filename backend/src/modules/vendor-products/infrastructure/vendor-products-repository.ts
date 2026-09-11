import type {
  CreateProductInput,
  ProductDetail,
  UpdateProductInput,
} from '@prommarket/contracts'
import { Prisma } from '../../../generated/prisma/client'

import type { DbClient } from '../../../db'
import { VendorProductFailure } from '../domain/errors'
import type { VendorProductRepository } from '../application/ports'

export type { VendorProductRepository }

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
  views: number
  featuredUntil: Date | null
  createdAt: Date
  updatedAt: Date
  images: Array<{ id: string; url: string; alt: string | null; order: number; isPrimary: boolean }>
  prices: Array<{ id: string; type: string; price: { toString(): string } | null; currency: string; includesVat: boolean; vatRate: number; volumeFrom: number | null; volumeTo: number | null }>
  attributes: Array<{ id: string; value: unknown; attribute: { id: string; name: string; slug: string } }>
  category: { id: string; name: string; slug: string }
  vendor: { id: string; companyName: string; verified: boolean; verificationTier: string; description: string | null; rating: { toString(): string }; totalDeals: number }
}

const detailInclude = {
  images: { orderBy: { order: 'asc' as const } },
  prices: { orderBy: { type: 'asc' as const } },
  attributes: { include: { attribute: { select: { id: true, name: true, slug: true } } } },
  category: { select: { id: true } },
  vendor: { select: { id: true, companyName: true, verified: true, verificationTier: true, description: true, rating: true, totalDeals: true } },
} as const

// Mapper mirrors the catalog module's toProductDetail exactly so the wire shape
// matches productDetailSchema. The vendor surface returns the same DTO.
function toProductDetail(row: ProductDetailRow): ProductDetail {
  const mainPrice = row.prices.find((p) => p.type === 'fixed') ?? row.prices[0]
  const primaryImg = [...row.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order,
  )[0]
  const volumeDiscount = row.prices.find((p) => p.type === 'volume')
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
    sku: row.sku,
    brand: row.brand,
    status: row.status as ProductDetail['status'],
    availability: row.availability as ProductDetail['availability'],
    mainPrice: mainPrice?.price ? mainPrice.price.toString() : null,
    currency: mainPrice?.currency ?? 'RUB',
    volumeDiscountPercent,
    primaryImage: primaryImg
      ? {
          id: primaryImg.id,
          url: primaryImg.url,
          alt: primaryImg.alt,
          order: primaryImg.order,
          isPrimary: primaryImg.isPrimary,
        }
      : null,
    vendorId: row.vendor.id,
    vendorName: row.vendor.companyName,
    vendorVerified: row.vendor.verified,
    vendorVerificationTier: row.vendor.verificationTier as ProductDetail['vendorVerificationTier'],
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
      type: p.type as ProductDetail['prices'][number]['type'],
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
      value: pa.value as ProductDetail['attributes'][number]['value'],
    })),
    vendorDescription: row.vendor.description ?? null,
    vendorRating: Number(row.vendor.rating.toString()),
    vendorTotalDeals: row.vendor.totalDeals,
  }
}

export function createPrismaVendorProductsRepository(db: DbClient): VendorProductRepository {
  return {
    async listByVendor(vendorId) {
      const rows = await db.product.findMany({
        where: { vendorId },
        include: detailInclude,
        orderBy: { createdAt: 'desc' },
      })
      return rows.map((r) => toProductDetail(r as unknown as ProductDetailRow))
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
      return toProductDetail(row as unknown as ProductDetailRow)
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
      return toProductDetail(product as unknown as ProductDetailRow)
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
      return toProductDetail(updated as unknown as ProductDetailRow)
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
