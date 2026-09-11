import type { ProductStatus } from '@web-app-demo/contracts'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { useCart, useFavorites } from '@/features/marketplace-collections/use-local-collection'
import { ProductCard } from './components/ProductCard'
import { ProductDetail } from './components/ProductDetail'
import { SearchSuggest } from './components/SearchSuggest'
import { useCatalogCategoriesQuery, useCatalogProductsQuery } from './queries'
import { productStatusLabel } from './model'

/**
 * Product detail route component. Re-exports the ProductDetail component as a
 * page-level entry so `src/pages.tsx` can lazy-load it like other routes.
 */
export function ProductDetailPage() {
  return <ProductDetail />
}

/**
 * Public marketplace catalog.
 *
 * Filter state lives in the URL search params (via TanStack Router's
 * `validateSearch` on the route), so a catalog URL is shareable and
 * back/forward works. This is a deliberate upgrade over the original, where
 * filters lived only in a Zustand store and the URL never changed.
 *
 * The page is intentionally a single route component rather than a nested
 * layout: a public marketplace shell (header/footer/cart) will be added in a
 * later iteration and the catalog will slot under it without changing this
 * component's contract.
 */
const STATUS_OPTIONS: ProductStatus[] = ['new', 'used', 'refurbished', 'spare_parts', 'storage']
const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Сначала новые' },
  { value: 'updatedAt', label: 'По обновлению' },
  { value: 'title', label: 'По названию' },
  { value: 'views', label: 'По популярности' },
  { value: 'priceAsc', label: 'Сначала дешёвые' },
  { value: 'priceDesc', label: 'Сначала дорогие' },
] as const
const PAGE_SIZE = 12

type CatalogSearch = {
  categoryId?: string
  search?: string
  status?: string
  sortBy?: string
  priceMin?: string
  priceMax?: string
  page?: number
}

export function CatalogPage() {
  const navigate = useNavigate({ from: '/catalog' })
  const search = useSearch({ strict: false }) as CatalogSearch
  const favorites = useFavorites()
  const cart = useCart()

  const activeStatuses = useMemo<ProductStatus[]>(
    () => (search.status ? (search.status.split(',') as ProductStatus[]) : []),
    [search.status],
  )

  const sortValue = search.sortBy ?? 'createdAt'
  const isPriceSort = sortValue === 'priceAsc' || sortValue === 'priceDesc'

  const productsQuery = useMemo(
    () => ({
      page: search.page ?? 1,
      pageSize: PAGE_SIZE,
      sortBy: (isPriceSort ? 'price' : sortValue) as 'createdAt',
      sortDir: (sortValue === 'priceAsc' ? 'asc' : 'desc') as 'desc',
      categoryId: search.categoryId,
      search: search.search,
      status: activeStatuses.length > 0 ? activeStatuses : undefined,
      priceMin: search.priceMin !== undefined ? Number(search.priceMin) : undefined,
      priceMax: search.priceMax !== undefined ? Number(search.priceMax) : undefined,
    }),
    [search.page, sortValue, isPriceSort, search.categoryId, search.search, search.priceMin, search.priceMax, activeStatuses],
  )

  const categoriesQuery = useCatalogCategoriesQuery()
  const productsResult = useCatalogProductsQuery(productsQuery)

  const updateSearch = (patch: Partial<CatalogSearch>) => {
    void navigate({
      to: '/catalog',
      search: (prev) => ({ ...prev, ...patch, page: patch.page !== undefined ? patch.page : 1 }),
    })
  }

  const toggleStatus = (status: ProductStatus) => {
    const next = activeStatuses.includes(status)
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status]
    updateSearch({ status: next.length > 0 ? next.join(',') : undefined })
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">ПромМаркет</h1>
            <p className="text-sm text-muted-foreground">B2B маркетплейс промышленного оборудования</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/">Главная</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/favorites">
                Избранное{favorites.count > 0 ? ` · ${favorites.count}` : ''}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/cart">Корзина{cart.count > 0 ? ` · ${cart.count}` : ''}</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: categories + filters */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <CategoryTree
            categories={categoriesQuery.data}
            loading={categoriesQuery.isLoading}
            selectedId={search.categoryId}
            onSelect={(categoryId) => updateSearch({ categoryId })}
          />
          <PriceFilter
            priceMin={search.priceMin}
            priceMax={search.priceMax}
            onCommit={(priceMin, priceMax) => updateSearch({ priceMin, priceMax })}
          />
          <FilterGroup title="Состояние">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button key={status} type="button" onClick={() => toggleStatus(status)}>
                  <Badge
                    variant={activeStatuses.includes(status) ? 'default' : 'outline'}
                    className="cursor-pointer"
                  >
                    {productStatusLabel[status]}
                  </Badge>
                </button>
              ))}
            </div>
          </FilterGroup>
        </aside>

        {/* Main: search + sort + grid */}
        <main className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <SearchSuggest
              key={search.search ?? ''}
              defaultValue={search.search ?? ''}
              placeholder="Поиск по названию, SKU, бренду…"
              className="sm:max-w-md"
              onCommit={(q) => updateSearch({ search: q || undefined })}
            />
            <select
              value={search.sortBy ?? 'createdAt'}
              onChange={(e) => updateSearch({ sortBy: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {productsResult.isLoading
                ? 'Загрузка…'
                : `Найдено: ${productsResult.data?.total ?? 0}`}
            </span>
          </div>

          {productsResult.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
              ))}
            </div>
          ) : productsResult.data && productsResult.data.items.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {productsResult.data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={productsResult.data.page}
                totalPages={productsResult.data.totalPages}
                onChange={(page) => updateSearch({ page })}
              />
            </>
          ) : (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>Товары не найдены</EmptyTitle>
                <EmptyDescription>
                  Попробуйте изменить фильтры или поисковый запрос.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components (kept local — not reused yet)
// ---------------------------------------------------------------------------

function CategoryTree({
  categories,
  loading,
  selectedId,
  onSelect,
}: {
  categories: import('@web-app-demo/contracts').Category[] | undefined
  loading: boolean
  selectedId: string | undefined
  onSelect: (id: string | undefined) => void
}) {
  if (loading) {
    return (
      <FilterGroup title="Категории">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </FilterGroup>
    )
  }
  if (!categories || categories.length === 0) return null
  return (
    <FilterGroup title="Категории">
      <ul className="space-y-1 text-sm">
        <li>
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            className={cn(
              'w-full rounded px-2 py-1 text-left hover:bg-accent',
              !selectedId && 'font-medium text-foreground',
            )}
          >
            Все категории
          </button>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => onSelect(category.id)}
              className={cn(
                'w-full rounded px-2 py-1 text-left hover:bg-accent',
                selectedId === category.id && 'bg-accent font-medium text-foreground',
              )}
            >
              {category.icon} {category.name}
              <span className="ml-1 text-xs text-muted-foreground">{category.productCount}</span>
            </button>
            {category.children.length > 0 && (
              <ul className="ml-3 mt-1 space-y-1 border-l pl-2">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(child.id)}
                      className={cn(
                        'w-full rounded px-2 py-0.5 text-left text-muted-foreground hover:bg-accent hover:text-foreground',
                        selectedId === child.id && 'font-medium text-foreground',
                      )}
                    >
                      {child.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </FilterGroup>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  )
}

/**
 * Avito-style price range filter. Commits on Enter/blur; drafts that are not
 * plain non-negative integers are treated as unset.
 */
function PriceFilter({
  priceMin,
  priceMax,
  onCommit,
}: {
  priceMin: string | undefined
  priceMax: string | undefined
  onCommit: (priceMin: string | undefined, priceMax: string | undefined) => void
}) {
  const [min, setMin] = useState(priceMin ?? '')
  const [max, setMax] = useState(priceMax ?? '')

  // Re-sync the draft when the URL changes elsewhere (back/forward, reset).
  useEffect(() => {
    setMin(priceMin ?? '')
    setMax(priceMax ?? '')
  }, [priceMin, priceMax])

  const commit = () => {
    const nextMin = /^\d+$/.test(min.trim()) ? min.trim() : undefined
    const nextMax = /^\d+$/.test(max.trim()) ? max.trim() : undefined
    if (nextMin !== priceMin || nextMax !== priceMax) onCommit(nextMin, nextMax)
  }

  return (
    <FilterGroup title="Цена, ₽">
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          placeholder="от"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-8"
          aria-label="Цена от"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          inputMode="numeric"
          placeholder="до"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-8"
          aria-label="Цена до"
        />
      </div>
    </FilterGroup>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Назад
      </Button>
      <span className="text-sm text-muted-foreground">
        Стр. {page} из {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Вперёд →
      </Button>
    </div>
  )
}
