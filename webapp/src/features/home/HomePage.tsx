import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { listCategories, listProducts } from '@/features/catalog/api'

/**
 * Public landing page (ПромМаркет). Shown at `/` for anonymous visitors and as
 * the role-redirect target's public face before login. Showcases the catalog:
 * hero with search, category grid, and featured/popular products.
 *
 * No auth dependency — everything reads through the public catalog client.
 */
export function HomePage() {
  const [search, setSearch] = useState('')

  const categoriesQuery = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => listCategories(),
  })
  const featuredQuery = useQuery({
    queryKey: ['catalog', 'products', 'featured'],
    queryFn: () =>
      listProducts({
        page: 1,
        pageSize: 8,
        sortBy: 'views',
        sortDir: 'desc',
      }),
  })

  const rootCategories = (categoriesQuery.data ?? []).slice(0, 8)
  const featured = featuredQuery.data?.items ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <section className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
          ПромМаркет
        </h1>
        <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
          B2B-маркетплейс промышленного оборудования. Надёжные поставщики,
          проверенные товары, прямые сделки.
        </p>
        <form
          className="mx-auto flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const q = search.trim()
            window.location.href = q
              ? `/catalog?search=${encodeURIComponent(q)}`
              : '/catalog'
          }}
        >
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск оборудования, товаров, брендов…"
              className="pl-10"
            />
          </div>
          <Button type="submit">
            Найти
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" />
          </Button>
        </form>
      </section>

      {/* Categories */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Категории</h2>
          <Link to="/catalog" className="text-sm text-primary hover:underline">
            Все категории →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoriesQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))
            : rootCategories.map((cat) => (
                <Link key={cat.id} to="/catalog" search={{ categoryId: cat.id }}>
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                      <span className="text-3xl">{cat.icon ?? '📦'}</span>
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {cat.productCount} товаров
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>
      </section>

      {/* Featured / popular products */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Популярные товары</h2>
          <Link to="/catalog" className="text-sm text-primary hover:underline">
            Весь каталог →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {featuredQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))
            : featured.map((product) => (
                <Link
                  key={product.id}
                  to="/catalog/$productId"
                  params={{ productId: product.id }}
                >
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                    <div className="aspect-square bg-muted">
                      {product.primaryImage ? (
                        <img
                          src={product.primaryImage}
                          alt={product.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          Нет фото
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="mb-1 flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {product.brand ?? 'Бренд'}
                        </Badge>
                        {product.vendorVerified && (
                          <Badge variant="outline" className="text-xs text-emerald-600">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {product.mainPrice
                          ? formatPrice(product.mainPrice, product.currency)
                          : 'Цена по запросу'}
                      </div>
                      <div className="text-xs text-muted-foreground">{product.vendorName}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>
      </section>

      {/* CTA for vendors */}
      <section>
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="mb-1 text-2xl font-semibold">Вы поставщик оборудования?</h2>
              <p className="text-primary-foreground/80">
                Размещайте товары, получайте заявки от покупателей, пройдите верификацию.
              </p>
            </div>
            <Button variant="secondary" size="lg" asChild>
              <Link to="/signup">Стать поставщиком</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function formatPrice(value: string | number, currency: string): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`
}
