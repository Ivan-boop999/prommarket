import type { UserDto } from '@web-app-demo/contracts'
import { useState } from 'react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useActivateAddOnMutation,
  useBrokerFeesQuery,
  useBrokerStatsQuery,
  useConfirmAddOnMutation,
  useConfirmBrokerFeePaymentMutation,
  useConfirmFeaturedMutation,
  useConfirmLeadPurchaseMutation,
  useConfirmSubscriptionInvoiceMutation,
  useCreateFeaturedPlacementMutation,
  useCurrentSubscriptionQuery,
  useInvoicesQuery,
  useInvoiceBrokerFeeMutation,
  useLeadBalanceQuery,
  useLeadCreditPriceQuery,
  useLeadLedgerQuery,
  useMyVerificationQuery,
  usePendingVerificationQuery,
  usePurchaseLeadCreditsMutation,
  useReviewVerificationMutation,
  useSubscribeMutation,
  useSubscriptionInvoicesQuery,
  useSubscriptionPlansQuery,
} from './queries'

/**
 * Monetization pages. Each panel is a self-contained screen rendered inside
 * its role's WorkspaceShell. They share the query/mutation hooks in queries.ts
 * and the API client in api.ts; UI follows the admin feature (PageContainer +
 * PageHeader + Cards/Tables).
 */

const DEFAULT_PAGE_QUERY = { page: 1, pageSize: 20 }

// ===========================================================================
// VENDOR: home
// ===========================================================================

export function VendorHomePanel({ user }: { user: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        title={`Кабинет поставщика`}
        description={`Добро пожаловать, ${user.displayName ?? user.email}. Управляйте подпиской, лидами, верификацией и продвижением.`}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VendorSubscriptionSummaryCard />
        <VendorCreditsSummaryCard />
        <VendorVerificationSummaryCard />
      </div>
    </PageContainer>
  )
}

function VendorSubscriptionSummaryCard() {
  const { data, isLoading } = useCurrentSubscriptionQuery()
  if (isLoading) return <SkeletonCard title="Подписка" />
  const plan = data?.plan
  return (
    <Card>
      <CardHeader>
        <CardTitle>Подписка</CardTitle>
        <CardDescription>Текущий тариф</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{plan?.name ?? 'Тариф'}</div>
            <div className="text-muted-foreground">Статус: {subscriptionStatusLabel(data.status)}</div>
            {data.periodEnd && (
              <div className="text-muted-foreground">Действует до: {formatDate(data.periodEnd)}</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Активная подписка отсутствует</div>
        )}
      </CardContent>
    </Card>
  )
}

function VendorCreditsSummaryCard() {
  const { data, isLoading } = useLeadBalanceQuery()
  if (isLoading) return <SkeletonCard title="Лид-кредиты" />
  return (
    <Card>
      <CardHeader>
        <CardTitle>Лид-кредиты</CardTitle>
        <CardDescription>Баланс для разблокировки заявок</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{data?.balance ?? 0}</div>
      </CardContent>
    </Card>
  )
}

function VendorVerificationSummaryCard() {
  const { data, isLoading } = useMyVerificationQuery()
  if (isLoading) return <SkeletonCard title="Верификация" />
  return (
    <Card>
      <CardHeader>
        <CardTitle>Верификация</CardTitle>
        <CardDescription>Статус проверки компании</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <Badge variant="secondary">{verificationStatusLabel(data.status)}</Badge>
        ) : (
          <div className="text-sm text-muted-foreground">Заявка не подана</div>
        )}
      </CardContent>
    </Card>
  )
}

// ===========================================================================
// VENDOR: subscription / billing
// ===========================================================================

export function VendorBillingPanel() {
  const plansQuery = useSubscriptionPlansQuery()
  const currentQuery = useCurrentSubscriptionQuery()
  const invoicesQuery = useSubscriptionInvoicesQuery()
  const subscribeMutation = useSubscribeMutation()

  return (
    <PageContainer>
      <PageHeader title="Подписка" description="Выберите тариф для размещения товаров на маркетплейсе." />
      {currentQuery.data && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Текущая подписка</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div>Тариф: <span className="font-medium">{currentQuery.data.plan?.name}</span></div>
            <div>Статус: {subscriptionStatusLabel(currentQuery.data.status)}</div>
            {currentQuery.data.periodEnd && (
              <div>Действует до: {formatDate(currentQuery.data.periodEnd)}</div>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plansQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} title="" />)
          : plansQuery.data?.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.billingPeriod}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm">
                  <div className="text-2xl font-bold">
                    {formatMoney(plan.price)} <span className="text-sm font-normal">{plan.currency}</span>
                  </div>
                  {plan.maxProducts !== null && <div>До {plan.maxProducts} товаров</div>}
                  {plan.includedLeadCredits > 0 && <div>+{plan.includedLeadCredits} лид-кредитов</div>}
                  {plan.hasFeatured && <div>Включено продвижение</div>}
                  {plan.hasPrioritySupport && <div>Приоритетная поддержка</div>}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={subscribeMutation.isPending}
                    onClick={() =>
                      subscribeMutation.mutate({ planId: plan.id }, {
                        onSuccess: () =>
                          console.info('Заявка оформлена. Счёт выставлен — оплатите по реквизитам.'),
                        onError: (e: Error) => console.error(e.message),
                      })
                    }
                  >
                    Оформить
                  </Button>
                </CardFooter>
              </Card>
            ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Счета</CardTitle>
          <CardDescription>Оплатите счёт банковским переводом; подтверждение — вручную менеджером.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable rows={invoicesQuery.data ?? []} isLoading={invoicesQuery.isLoading} />
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// VENDOR: lead credits
// ===========================================================================

export function VendorCreditsPanel() {
  const balanceQuery = useLeadBalanceQuery()
  const ledgerQuery = useLeadLedgerQuery()
  const priceQuery = useLeadCreditPriceQuery()
  const purchaseMutation = usePurchaseLeadCreditsMutation()
  const [credits, setCredits] = useState(10)

  return (
    <PageContainer>
      <PageHeader title="Лид-кредиты" description="Покупайте кредиты для разблокировки контактов заявок (RFQ)." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Баланс</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balanceQuery.data?.balance ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Цена за кредит</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Базовая: {priceQuery.data ? formatMoney(priceQuery.data.pricePerCredit) : '…'} {priceQuery.data?.currency}</div>
            {priceQuery.data?.tiers.map((tier) => (
              <div key={tier.minCredits} className="text-muted-foreground">
                от {tier.minCredits} шт.: {formatMoney(tier.pricePerCredit)}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Купить</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <label className="block">Количество: {credits}</label>
            <input
              type="range"
              min={1}
              max={500}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="w-full"
            />
            <Button
              className="w-full"
              disabled={purchaseMutation.isPending}
              onClick={() =>
                purchaseMutation.mutate(
                  { credits },
                  {
                    onSuccess: () => console.info('Счёт на покупку кредитов выставлен.'),
                    onError: (e: Error) => console.error(e.message),
                  },
                )
              }
            >
              Купить {credits} кредитов
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>История операций</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Операция</TableHead>
                <TableHead className="text-right">Изменение</TableHead>
                <TableHead className="text-right">Баланс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ledgerQuery.data ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>{leadReasonLabel(entry.reason)}</TableCell>
                  <TableCell className={`text-right ${entry.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {entry.delta >= 0 ? '+' : ''}{entry.delta}
                  </TableCell>
                  <TableCell className="text-right">{entry.balanceAfter}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// VENDOR: verification
// ===========================================================================

export function VendorVerifyPanel() {
  const myQuery = useMyVerificationQuery()
  return (
    <PageContainer>
      <PageHeader
        title="Верификация компании"
        description="Проверенный поставщик получает бейдж доверия и приоритет в выдаче."
      />
      {myQuery.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Текущая заявка</CardTitle>
            <CardDescription>Статус: {verificationStatusLabel(myQuery.data.status)}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>Запрошенный уровень: <Badge variant="secondary">{myQuery.data.requestedTier}</Badge></div>
            {myQuery.data.submittedAt && <div>Подана: {formatDate(myQuery.data.submittedAt)}</div>}
            {myQuery.data.reviewedAt && <div>Рассмотрена: {formatDate(myQuery.data.reviewedAt)}</div>}
            {myQuery.data.reviewerNotes && <div>Комментарий модератора: {myQuery.data.reviewerNotes}</div>}
            {myQuery.data.expiresAt && <div>Действует до: {formatDate(myQuery.data.expiresAt)}</div>}
            <div>Документов: {myQuery.data.documents.length}</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Подать заявку</CardTitle>
            <CardDescription>Загрузите документы (ИНН, ОГРН, лицензии) для проверки.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Форма загрузки документов будет доступна после расширения модуля загрузок
            (поддержка PDF). Сейчас заявку можно создать через API.
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}

// ===========================================================================
// VENDOR: featured placement
// ===========================================================================

export function VendorFeaturedPanel() {
  const mutation = useCreateFeaturedPlacementMutation()
  const [productId, setProductId] = useState('')
  const [placement, setPlacement] = useState<'category_top' | 'home_featured' | 'search_boost'>('home_featured')
  const [durationDays, setDurationDays] = useState(7)
  
  return (
    <PageContainer>
      <PageHeader title="Продвижение товаров" description="Закрепите товар в категории, на главной или в поиске." />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Новая кампания</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="block">
            ID товара
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="UUID товара"
            />
          </label>
          <label className="block">
            Размещение
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={placement}
              onChange={(e) => setPlacement(e.target.value as typeof placement)}
            >
              <option value="home_featured">На главной</option>
              <option value="category_top">Вверх категории</option>
              <option value="search_boost">Буст в поиске</option>
            </select>
          </label>
          <label className="block">
            Длительность (дн.): {durationDays}
            <input
              type="range"
              min={1}
              max={90}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <Button
            disabled={mutation.isPending || !productId}
            onClick={() =>
              mutation.mutate(
                { productId, placement, durationDays },
                {
                  onSuccess: () => console.info('Счёт на продвижение выставлен'),
                  onError: (e: Error) => console.error('Ошибка', e.message),
                },
              )
            }
          >
            Оформить продвижение
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// VENDOR: SaaS add-ons
// ===========================================================================

export function VendorAddOnsPanel() {
  const mutation = useActivateAddOnMutation()
    const features: Array<{ code: 'crm' | 'analytics' | 'api_access' | 'tenders'; label: string; description: string }> = [
    { code: 'crm', label: 'CRM', description: 'Воронка сделок и история общения с клиентами.' },
    { code: 'analytics', label: 'Аналитика', description: 'Дашборды спроса и просмотров ваших товаров.' },
    { code: 'api_access', label: 'API доступ', description: 'Интеграция с 1C/ERP, выгрузка прайсов.' },
    { code: 'tenders', label: 'Тендеры', description: 'Участие в закупочных процедурах покупателей.' },
  ]
  return (
    <PageContainer>
      <PageHeader title="Модули" description="Дополнительные возможности для вашего кабинета." />
      <div className="grid gap-4 md:grid-cols-2">
        {features.map((f) => (
          <Card key={f.code}>
            <CardHeader>
              <CardTitle>{f.label}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    { feature: f.code },
                    {
                      onSuccess: () => console.info(`Запрос на «${f.label}» оформлен`),
                      onError: (e: Error) => console.error('Ошибка', e.message),
                    },
                  )
                }
              >
                Подключить
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}

// ===========================================================================
// ADMIN: verification queue
// ===========================================================================

export function AdminVerificationPanel() {
  const query = usePendingVerificationQuery()
  const reviewMutation = useReviewVerificationMutation()
  
  return (
    <PageContainer>
      <PageHeader title="Очередь верификации" description="Проверьте документы и одобрите или отклоните заявки." />
      {(query.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {query.isLoading ? 'Загрузка…' : 'Нет заявок на верификацию'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(query.data ?? []).map((req) => (
            <Card key={req.id}>
              <CardHeader>
                <CardTitle>Заявка {req.id.slice(0, 8)}</CardTitle>
                <CardDescription>
                  Уровень: {req.requestedTier} • Статус: {verificationStatusLabel(req.status)}
                  {req.submittedAt && ` • Подана: ${formatDate(req.submittedAt)}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {req.contactName && <div>Контакт: {req.contactName}</div>}
                {req.contactPhone && <div>Телефон: {req.contactPhone}</div>}
                {req.message && <div>Комментарий: {req.message}</div>}
                <div>Документов: {req.documents.length}</div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  variant="default"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate(
                      { id: req.id, input: { decision: 'approved' } },
                      {
                        onSuccess: () => console.info('Заявка одобрена'),
                        onError: (e: Error) => console.error('Ошибка', e.message),
                      },
                    )
                  }
                >
                  Одобрить
                </Button>
                <Button
                  variant="destructive"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate(
                      { id: req.id, input: { decision: 'rejected' } },
                      {
                        onSuccess: () => console.info('Заявка отклонена'),
                        onError: (e: Error) => console.error('Ошибка', e.message),
                      },
                    )
                  }
                >
                  Отклонить
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

// ===========================================================================
// ADMIN: billing (invoices, confirm payments)
// ===========================================================================

export function AdminBillingPanel() {
  const invoicesQuery = useInvoicesQuery()
  const confirmSubscription = useConfirmSubscriptionInvoiceMutation()
  const confirmLead = useConfirmLeadPurchaseMutation()
  const confirmFeatured = useConfirmFeaturedMutation()
  const confirmAddOn = useConfirmAddOnMutation()
  
  const onConfirm = (invoiceId: string, type: string) => {
    const handlers: Record<string, (id: string) => void> = {
      subscription: (id) => confirmSubscription.mutate({ invoiceId: id }),
      lead_credits: (id) => confirmLead.mutate({ invoiceId: id }),
      featured: (id) => confirmFeatured.mutate(id),
      add_on: (id) => confirmAddOn.mutate(id),
    }
    const handler = handlers[type]
    if (!handler) {
      console.error('Тип счёта не поддерживается')
      return
    }
    handler(invoiceId)
    console.info('Оплата подтверждена')
  }

  return (
    <PageContainer>
      <PageHeader title="Биллинг" description="Подтверждайте оплату счетов после банковского перевода." />
      <Card>
        <CardContent className="p-0">
          <InvoicesTable
            rows={invoicesQuery.data ?? []}
            isLoading={invoicesQuery.isLoading}
            action={(invoice) =>
              invoice.status === 'issued' ? (
                <Button size="sm" onClick={() => onConfirm(invoice.id, invoice.type)}>
                  Подтвердить оплату
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// BROKER: home + fees
// ===========================================================================

export function BrokerHomePanel() {
  const statsQuery = useBrokerStatsQuery()
  return (
    <PageContainer>
      <PageHeader title="Кабинет брокера" description="Обзор начисленных комиссий по сделкам." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Начислено" value={statsQuery.data ? formatMoney(statsQuery.data.accruedTotal) : '…'} />
        <StatCard title="Выставлено" value={statsQuery.data ? formatMoney(statsQuery.data.invoicedTotal) : '…'} />
        <StatCard title="Получено" value={statsQuery.data ? formatMoney(statsQuery.data.paidTotal) : '…'} />
      </div>
    </PageContainer>
  )
}

export function BrokerFeesPanel() {
  const feesQuery = useBrokerFeesQuery(DEFAULT_PAGE_QUERY)
  const invoiceMutation = useInvoiceBrokerFeeMutation()
  const confirmMutation = useConfirmBrokerFeePaymentMutation()
  
  return (
    <PageContainer>
      <PageHeader title="Комиссии" description="История комиссий по сделкам, выставление счетов и подтверждение оплаты." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сделка</TableHead>
                <TableHead>База</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Комиссия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feesQuery.data?.items ?? []).map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-mono text-xs">{fee.dealId.slice(0, 8)}</TableCell>
                  <TableCell>{formatMoney(fee.baseAmount)}</TableCell>
                  <TableCell>{fee.feePercent}%</TableCell>
                  <TableCell className="font-medium">{formatMoney(fee.feeAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{brokerFeeStatusLabel(fee.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {fee.status === 'accrued' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invoiceMutation.isPending}
                        onClick={() =>
                          invoiceMutation.mutate(fee.id, {
                            onSuccess: () => console.info('Счёт на комиссию выставлен'),
                            onError: (e: Error) => console.error('Ошибка', e.message),
                          })
                        }
                      >
                        Выставить счёт
                      </Button>
                    )}
                    {fee.status === 'invoiced' && (
                      <Button
                        size="sm"
                        disabled={confirmMutation.isPending}
                        onClick={() =>
                          confirmMutation.mutate(fee.id, {
                            onSuccess: () => console.info('Оплата комиссии подтверждена'),
                            onError: (e: Error) => console.error('Ошибка', e.message),
                          })
                        }
                      >
                        Подтвердить оплату
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// BUYER: home (placeholder until RFQ flow lands in iteration 3-5)
// ===========================================================================

export function BuyerHomePanel({ user }: { user: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        title="Кабинет покупателя"
        description={`Здравствуйте, ${user.displayName ?? user.email}. Здесь появятся ваши заявки (RFQ) и сделки.`}
      />
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Раздел заявок и сделок будет добавлен в итерации 5 (модуль deals + RFQ).
        </CardContent>
      </Card>
    </PageContainer>
  )
}

// ===========================================================================
// Shared UI helpers
// ===========================================================================

function SkeletonCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function InvoicesTable({
  rows,
  isLoading,
  action,
}: {
  rows: ReadonlyArray<{
    id: string
    number: string
    type: string
    amount: string
    currency: string
    status: string
    createdAt: string
  }>
  isLoading: boolean
  action?: (invoice: { id: string; type: string; status: string }) => React.ReactNode
}) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (rows.length === 0) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Счетов нет</div>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Номер</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Сумма</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата</TableHead>
          {action && <TableHead></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-mono text-xs">{inv.number}</TableCell>
            <TableCell>{invoiceTypeLabel(inv.type)}</TableCell>
            <TableCell>{formatMoney(inv.amount)} {inv.currency}</TableCell>
            <TableCell>
              <Badge variant="secondary">{invoiceStatusLabel(inv.status)}</Badge>
            </TableCell>
            <TableCell>{formatDate(inv.createdAt)}</TableCell>
            {action && <TableCell>{action(inv)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// --- Label/format helpers (Russian) ---

function subscriptionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Ожидает оплаты',
    active: 'Активна',
    past_due: 'Просрочена',
    cancelled: 'Отменена',
    expired: 'Истекла',
  }
  return map[status] ?? status
}

function verificationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Черновик',
    submitted: 'Подана',
    under_review: 'На рассмотрении',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    revoked: 'Отозвана',
  }
  return map[status] ?? status
}

function leadReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    purchase: 'Покупка',
    admin_grant: 'Начисление',
    rfq_unlock: 'Разблокировка заявки',
    monthly_reset: 'Сброс',
    refund: 'Возврат',
    subscription_grant: 'В рамках подписки',
  }
  return map[reason] ?? reason
}

function invoiceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    subscription: 'Подписка',
    lead_credits: 'Лид-кредиты',
    featured: 'Продвижение',
    broker_fee: 'Комиссия брокера',
    add_on: 'Модуль',
  }
  return map[type] ?? type
}

function invoiceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Черновик',
    issued: 'Выставлен',
    paid: 'Оплачен',
    overdue: 'Просрочен',
    cancelled: 'Отменён',
  }
  return map[status] ?? status
}

function brokerFeeStatusLabel(status: string): string {
  const map: Record<string, string> = {
    accrued: 'Начислена',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачена',
    written_off: 'Списана',
  }
  return map[status] ?? status
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatMoney(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}
