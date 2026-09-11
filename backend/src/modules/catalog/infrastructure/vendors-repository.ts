import type { VendorSummary } from '@prommarket/contracts'

import type { DbClient } from '../../../db'
import type { VendorReader } from '../application/ports'

/**
 * Vendor repository. Lists vendors with a computed `productCount` so the
 * catalog filter UI can show counts without a second round-trip per vendor.
 */
export function createPrismaVendorsRepository(db: DbClient): VendorReader {
  return {
    async list() {
      const vendors = await db.vendor.findMany({
        orderBy: [{ verified: 'desc' }, { rating: 'desc' }, { companyName: 'asc' }],
        include: {
          _count: { select: { products: true } },
        },
      })
      return vendors.map(toVendorSummary)
    },
  }
}

type VendorRow = {
  id: string
  companyName: string
  inn: string
  verified: boolean
  rating: { toString(): string }
  totalDeals: number
  city: string | null
  logo: string | null
  _count: { products: number }
}

function toVendorSummary(row: VendorRow): VendorSummary {
  return {
    id: row.id,
    companyName: row.companyName,
    inn: row.inn,
    verified: row.verified,
    // Decimal → number for the DTO; ratings have one decimal place.
    rating: Number(row.rating),
    totalDeals: row.totalDeals,
    city: row.city,
    logo: row.logo,
    productCount: row._count.products,
  }
}
