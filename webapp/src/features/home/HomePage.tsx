import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BoltIcon,
  BoxIcon,
  Fan01Icon,
  Fan02Icon,
  Fire02Icon,
  HammerIcon,
  Package02Icon,
  Settings02Icon,
  WarehouseIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Skeleton } from '@/components/ui/skeleton'
import { MarketplaceShell } from '@/components/marketplace/MarketplaceShell'
import { listCategories, listProducts, ProductCard, SearchSuggest } from '@/features/catalog'

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
 * Public landing page (ПромМаркет), Avito-style compact layout: search lives
 * only in the shell header, a slim brand line sits right under it, and the
 * first screen is a categories column (~1/5) next to the popular-products
 * grid — no hero, no scroll-to-see-content.
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

  const rootCategories = categoriesQuery.data ?? []
  const featured = featuredQuery.data?.items ?? []

  return (
    <MarketplaceShell>
      {/* Slim brand line right under the header (search lives in the header) */}
      <div className="mx-auto max-w-7xl px-4 pb-1 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-bold tracking-tight">ПромМаркет</h1>
          <p className="text-sm text-muted-foreground">
            маркетплейс промышленного оборудования — B2B, B2C, C2B и C2C
          </p>
        </div>
        {/* Compact search for narrow screens; desktop search is in the header */}
        <div className="mt-3 md:hidden">
          <SearchSuggest buttonLabel="Найти" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 pt-4 lg:grid-cols-[200px_1fr]">
        {/* Categories column (~1/5), Avito-style icon rows */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Категории
          </h2>
          <ul className="space-y-0.5 text-sm">
            {categoriesQuery.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-8 w-full" />
                  </li>
                ))
              : rootCategories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.slug] ?? BoxIcon
                  return (
                    <li key={cat.id}>
                      <Link
                        to="/catalog"
                        search={{ ...catalogSearch, categoryId: cat.id }}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                      >
                        <HugeiconsIcon icon={Icon} className="size-5 shrink-0 text-primary" />
                        <span className="min-w-0 truncate">{cat.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {cat.productCount}
                        </span>
                      </Link>
                    </li>
                  )
                })}
          </ul>
        </aside>

        {/* Popular products take the main area */}
        <main>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Популярные товары</h2>
            <Link
              to="/catalog"
              search={catalogSearch}
              className="text-sm font-medium text-primary hover:underline"
            >
              Весь каталог →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredQuery.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 w-full rounded-xl" />
                ))
              : featured.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
          </div>
        </main>
      </div>
    </MarketplaceShell>
  )
}
