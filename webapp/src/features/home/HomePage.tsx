import { Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  BoltIcon,
  BoxIcon,
  CalculatorIcon,
  Fan01Icon,
  Fan02Icon,
  Fire02Icon,
  HammerIcon,
  HandshakeIcon,
  Package02Icon,
  Rocket02Icon,
  Settings02Icon,
  Shield02Icon,
  WarehouseIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MarketplaceShell } from '@/components/marketplace/MarketplaceShell'
import {
  getProduct,
  listCategories,
  listProducts,
  ProductCard,
  SearchSuggest,
} from '@/features/catalog'
import { useRecentlyViewed } from '@/lib/use-recently-viewed'

const CATEGORY_ICONS: Record<string, typeof BoltIcon> = {
  dvigateli: Settings02Icon,
  elektrodvigateli: BoltIcon,
  'nasosnoe-oborudovanie': Fan02Icon,
  kompresory: Fan01Icon,
  stanki: HammerIcon,
  transformatory: BoltIcon,
  zapchasti: Package02Icon,
  gruzopodemnoe: WarehouseIcon,
  svarochnoe: Fire02Icon,
}

const catalogSearch = {
  categoryId: undefined,
  search: undefined,
  status: undefined,
  sortBy: undefined,
  page: undefined,
  priceMin: undefined,
  priceMax: undefined,
} as const

/**
 * Public landing page (ПромМаркет): marketplace shell + hero with search
 * suggestions, category grid with real icons, trust strip, popular products,
 * recently-viewed history, and the vendor CTA.
 */
export function MarketplaceHomePage() {
  const categoriesQuery = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => listCategories(),
  })
  const featuredQuery = useQuery({
    queryKey: ['catalog', 'products', 'featured'],
    queryFn: () => listProducts({ page: 1, pageSize: 8, sortBy: 'views', sortDir: 'desc' }),
  })

  const rootCategories = (categoriesQuery.data ?? []).slice(0, 8)
  const featured = featuredQuery.data?.items ?? []
  const vendorCount = new Set(featured.map((p) => p.vendorId)).size

  return (
    <MarketplaceShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-12 text-white md:px-12 md:py-16">
          <HugeiconsIcon
            icon={Settings02Icon}
            className="pointer-events-none absolute -right-8 -top-10 size-56 text-white/5"
          />
          <HugeiconsIcon
            icon={BoltIcon}
            className="pointer-events-none absolute -bottom-12 right-40 size-44 text-white/5"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-200">
              <HugeiconsIcon icon={Shield02Icon} className="size-3.5" />
              B2B маркетплейс промышленного оборудования
            </span>
            <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              Оборудование от проверенных поставщиков — напрямую, без посредников
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-sm text-slate-300 md:text-base">
              Дизель-генераторы, станки, насосы, компрессоры и комплектующие.
              Запросите цену в один клик — поставщики отвечают напрямую.
            </p>
            <div className="mx-auto max-w-2xl">
              <SearchSuggest buttonLabel="Найти" className="text-left" />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 md:text-sm">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Shield02Icon} className="size-4 text-blue-400" />
                Верификация поставщиков
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={HandshakeIcon} className="size-4 text-blue-400" />
                Прямые сделки
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={CalculatorIcon} className="size-4 text-blue-400" />
                Цены по объёму
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Категории</h2>
          <Link to="/catalog" search={catalogSearch} className="text-sm font-medium text-primary hover:underline">
            Все категории →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoriesQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            : rootCategories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.slug] ?? BoxIcon
                return (
                  <Link key={cat.id} to="/catalog" search={{ ...catalogSearch, categoryId: cat.id }}>
                    <Card className="h-full border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <HugeiconsIcon icon={Icon} className="size-6" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{cat.name}</span>
                          <span className="block text-xs text-muted-foreground">{cat.productCount} товаров</span>
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
        </div>
      </section>

      {/* Recently viewed */}
      <RecentlyViewedSection />

      {/* Popular products */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Популярные товары</h2>
          <Link to="/catalog" search={catalogSearch} className="text-sm font-medium text-primary hover:underline">
            Весь каталог →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {featuredQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)
            : featured.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* Trust / value props */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Shield02Icon,
              title: 'Проверенные поставщики',
              text: 'Трёхуровневая верификация: документы, история, отзывы.',
            },
            {
              icon: HandshakeIcon,
              title: 'Прямые сделки',
              text: 'Общайтесь с поставщиком напрямую и согласовывайте условия.',
            },
            {
              icon: CalculatorIcon,
              title: 'Цены по объёму',
              text: 'Прозрачные скидки за партию — видны в карточке товара.',
            },
            {
              icon: Rocket02Icon,
              title: 'Запрос КП за минуту',
              text: 'Одна форма — и поставщики получают вашу заявку.',
            },
          ].map((item) => (
            <Card key={item.title} className="border-border/60">
              <CardContent className="space-y-2 p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon icon={item.icon} className="size-5" />
                </span>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {vendorCount > 0 && (
          <p className="pt-4 text-center text-xs text-muted-foreground">
            Уже {vendorCount} проверенных поставщиков и {featuredQuery.data?.total ?? 0} товаров в каталоге
          </p>
        )}
      </section>

      {/* CTA for vendors */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <Card className="border-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="mb-1 text-2xl font-semibold">Вы поставщик оборудования?</h2>
              <p className="text-blue-100">
                Размещайте товары, получайте заявки от покупателей, пройдите верификацию.
              </p>
            </div>
            <Link
              to="/signup"
              search={{ returnTo: undefined }}
              className="shrink-0 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Стать поставщиком
            </Link>
          </CardContent>
        </Card>
      </section>
    </MarketplaceShell>
  )
}

/**
 * «Вы недавно смотрели» — the latest browsed products (localStorage ids →
 * product details). Hidden entirely until the visitor has any history.
 */
function RecentlyViewedSection() {
  const { ids } = useRecentlyViewed()
  const recentIds = ids.slice(0, 4)

  const queries = useQueries({
    queries: recentIds.map((id) => ({
      queryKey: ['catalog', 'product', id],
      queryFn: () => getProduct(id),
      staleTime: 60_000,
    })),
  })
  const products = queries.flatMap((q) => (q.data ? [q.data] : [])).slice(0, 4)
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Вы недавно смотрели</h2>
        <Link to="/catalog" search={catalogSearch} className="text-sm font-medium text-primary hover:underline">
          Смотреть больше →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((product) => (
          <Link key={product.id} to="/catalog/$productId" params={{ productId: product.id }}>
            <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
              <div className="aspect-[4/3] bg-muted">
                {product.images[0] ? (
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt ?? product.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">Нет фото</div>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {product.mainPrice
                    ? formatPrice(product.mainPrice, product.currency)
                    : 'Цена по запросу'}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

function formatPrice(value: string | number, currency: string): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`
}
