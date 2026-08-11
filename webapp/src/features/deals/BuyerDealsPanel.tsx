import type { UserDto } from '@web-app-demo/contracts'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMyDealsQuery } from './queries'

/**
 * Buyer's deal pipeline. Shows every RFQ/deal the buyer has placed, with its
 * current status. The status labels mirror the server-side state machine
 * (DEAL_STATUS_TRANSITIONS in contracts).
 */
export function BuyerDealsPanel({ user }: { user: UserDto }) {
  const dealsQuery = useMyDealsQuery({ page: 1, pageSize: 50 })
  const deals = dealsQuery.data?.items ?? []

  return (
    <PageContainer>
      <PageHeader
        title="Мои заявки"
        description={`Здравствуйте, ${user.displayName ?? user.email}. Здесь ваши запросы КП и сделки.`}
      />
      <Card>
        <CardContent className="p-0">
          {dealsQuery.isLoading ? (
            <Skeleton className="m-4 h-32 w-auto" />
          ) : deals.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              У вас пока нет заявок. Откройте каталог и нажмите «Запросить КП» на товаре.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>Заявка</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead>Кол-во</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-mono text-xs">{deal.dealNumber}</TableCell>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell className="text-muted-foreground">{deal.productTitle ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{deal.vendorName ?? '—'}</TableCell>
                    <TableCell>{deal.quantity ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(deal.status)}>{statusLabel(deal.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Новая',
    verification: 'На проверке',
    negotiation: 'Переговоры',
    proposal: 'Предложение',
    connection: 'Связь',
    completed: 'Завершена',
    cancelled: 'Отменена',
  }
  return map[status] ?? status
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'cancelled') return 'destructive'
  return 'secondary'
}
