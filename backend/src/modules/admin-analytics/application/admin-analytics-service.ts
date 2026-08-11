import type { DbClient } from '../../../db'

/**
 * Admin analytics — real DB aggregates, not mock numbers. Returns counts and
 * sums the admin dashboard tiles bind to. Kept separate from the users module
 * so the analytics query surface can grow without touching auth/admin user CRUD.
 */
export type AdminAnalytics = {
  dealsByStatus: Array<{ status: string; count: number }>
  dealsByType: Array<{ type: string; count: number }>
  topCategories: Array<{ categoryId: string; categoryName: string; productCount: number }>
  avgDealValue: string
  totalDeals: number
  totalProducts: number
  totalVendors: number
  totalBuyers: number
  activeSubscriptions: number
  subscriptionMrr: string
  commissionsAccrued: string
  commissionsPaid: string
}

export class AdminAnalyticsService {
  constructor(private readonly db: DbClient) {}

  async getAnalytics(): Promise<AdminAnalytics> {
    const [
      dealsByStatusRows,
      dealsByTypeRows,
      topCategoryRows,
      dealAgg,
      totalDeals,
      totalProducts,
      totalVendors,
      totalBuyers,
      activeSubscriptions,
      mrrAgg,
      commissionAgg,
    ] = await Promise.all([
      this.db.deal.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.deal.groupBy({ by: ['type'], _count: { _all: true } }),
      this.db.category.findMany({
        orderBy: { productCount: 'desc' },
        take: 10,
        select: { id: true, name: true, productCount: true },
      }),
      this.db.deal.aggregate({ _avg: { totalAmount: true }, _count: { _all: true } }),
      this.db.deal.count(),
      this.db.product.count(),
      this.db.vendor.count(),
      this.db.buyer.count(),
      this.db.vendorSubscription.count({ where: { status: 'active' } }),
      this.db.vendorSubscription.aggregate({
        where: { status: 'active' },
        _sum: { amount: true },
      }),
      this.db.brokerFeeLedger.groupBy({
        by: ['status'],
        _sum: { feeAmount: true },
      }),
    ])

    const avgDealValue = dealAgg._avg.totalAmount
    const mrr = mrrAgg._sum.amount
    const commissionsAccrued = commissionAgg.find((c) => c.status === 'accrued')?._sum.feeAmount
    const commissionsPaid = commissionAgg.find((c) => c.status === 'paid')?._sum.feeAmount

    return {
      dealsByStatus: dealsByStatusRows.map((r) => ({ status: r.status, count: r._count._all })),
      dealsByType: dealsByTypeRows.map((r) => ({ type: r.type, count: r._count._all })),
      topCategories: topCategoryRows.map((r) => ({
        categoryId: r.id,
        categoryName: r.name,
        productCount: r.productCount,
      })),
      avgDealValue: avgDealValue ? avgDealValue.toString() : '0',
      totalDeals,
      totalProducts,
      totalVendors,
      totalBuyers,
      activeSubscriptions,
      subscriptionMrr: mrr ? mrr.toString() : '0',
      commissionsAccrued: commissionsAccrued ? commissionsAccrued.toString() : '0',
      commissionsPaid: commissionsPaid ? commissionsPaid.toString() : '0',
    }
  }
}
