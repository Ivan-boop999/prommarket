import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth'

const analyticsSchema = z
  .object({
    dealsByStatus: z.array(z.object({ status: z.string(), count: z.number().int() }).strict()),
    dealsByType: z.array(z.object({ type: z.string(), count: z.number().int() }).strict()),
    topCategories: z.array(
      z.object({ categoryId: z.string(), categoryName: z.string(), productCount: z.number().int() }).strict(),
    ),
    avgDealValue: z.string(),
    totalDeals: z.number().int(),
    totalProducts: z.number().int(),
    totalVendors: z.number().int(),
    totalBuyers: z.number().int(),
    activeSubscriptions: z.number().int(),
    subscriptionMrr: z.string(),
    commissionsAccrued: z.string(),
    commissionsPaid: z.string(),
  })
  .strict()

/**
 * Admin analytics dashboard. Real DB aggregates from /api/admin-analytics:
 * deal pipeline distribution, top categories, monetization metrics (MRR,
 * commissions), marketplace totals.
 */
export function AnalyticsPanel() {
  const auth = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['session', 'admin-analytics'],
    queryFn: () => auth.transport.request('/api/admin-analytics', analyticsSchema),
    enabled: auth.isAuthenticated,
  })

  return (
    <PageContainer>
      <PageHeader title="Аналитика" description="Сводные показатели маркетплейса и монетизации." />
      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Top-line metrics */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Сделок всего" value={String(data.totalDeals)} hint={`Средний чек: ${formatMoney(data.avgDealValue)} ₽`} />
            <MetricCard label="Товаров" value={String(data.totalProducts)} />
            <MetricCard label="Поставщиков" value={String(data.totalVendors)} />
            <MetricCard label="Покупателей" value={String(data.totalBuyers)} />
            <MetricCard label="Активных подписок" value={String(data.activeSubscriptions)} />
            <MetricCard label="MRR (подписки)" value={`${formatMoney(data.subscriptionMrr)} ₽`} />
            <MetricCard label="Комиссии начислено" value={`${formatMoney(data.commissionsAccrued)} ₽`} />
            <MetricCard label="Комиссии получено" value={`${formatMoney(data.commissionsPaid)} ₽`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Deal pipeline */}
            <Card>
              <CardHeader>
                <CardTitle>Сделки по статусам</CardTitle>
                <CardDescription>Распределение пайплайна</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Кол-во</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dealsByStatus.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell className="font-medium">{dealStatusLabel(row.status)}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Deal types */}
            <Card>
              <CardHeader>
                <CardTitle>Сделки по типам</CardTitle>
                <CardDescription>RFQ / спецификация / закупки</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Кол-во</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dealsByType.map((row) => (
                      <TableRow key={row.type}>
                        <TableCell className="font-medium">{dealTypeLabel(row.type)}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Top categories */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Топ категории</CardTitle>
              <CardDescription>По количеству товаров</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">Товаров</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topCategories.map((cat) => (
                    <TableRow key={cat.categoryId}>
                      <TableCell className="font-medium">{cat.categoryName}</TableCell>
                      <TableCell className="text-right">{cat.productCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

function dealStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Новые',
    verification: 'На проверке',
    negotiation: 'Переговоры',
    proposal: 'Предложение',
    connection: 'Связь установлена',
    completed: 'Завершённые',
    cancelled: 'Отменённые',
  }
  return map[status] ?? status
}

function dealTypeLabel(type: string): string {
  const map: Record<string, string> = {
    rfq: 'RFQ (запрос цены)',
    specification: 'Спецификация',
    price_proposal: 'Коммерческое предложение',
    procurement: 'Закупка',
  }
  return map[type] ?? type
}

function formatMoney(value: string): string {
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}
