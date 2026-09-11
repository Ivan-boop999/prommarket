import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FavouriteCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MarketplaceShell } from '@/components/marketplace/MarketplaceShell'
import { useCart, useCompare, useFavorites } from '@/lib/use-local-collection'
import { useRecentlyViewed } from '@/lib/use-recently-viewed'

import { formatPrice, productStatusLabel, productStatusTone } from '../model'
import { listProducts } from '../api'
import { ProductReviews } from './ProductReviews'
import { ProductCard } from './ProductCard'
import { RfqButton } from './RfqForm'
import { useProductDetailQuery } from '../queries'

/**
 * Product detail page. Reaches the catalog via TanStack Router param
 * (`/catalog/$productId`), so the URL is shareable and the back button works.
 *
 * Composition: gallery, attributes, pricing tiers, vendor block, reviews, plus
 * the Avito-style buyer affordances — view counter, favorites/compare/cart
 * actions, similar products from the same category, and a recently-viewed
 * mark that feeds the home page history section.
 */
export function ProductDetail() {
  const { productId } = useParams({ strict: false }) as { productId?: string }
  const query = useProductDetailQuery(productId)
  const product = query.data

  const favorites = useFavorites()
  const compare = useCompare()
  const cart = useCart()
  const { push: pushRecentlyViewed } = useRecentlyViewed()

  useEffect(() => {
    if (product?.id) pushRecentlyViewed(product.id)
  }, [product?.id, pushRecentlyViewed])

  const similarQuery = useQuery({
    queryKey: ['catalog', 'products', 'similar', product?.categoryId],
    queryFn: () =>
      listProducts({
        page: 1,
        pageSize: 5,
        categoryId: product!.categoryId,
        sortBy: 'views',
        sortDir: 'desc',
      }),
    enabled: Boolean(product?.categoryId),
  })
  const similar = (similarQuery.data?.items ?? [])
    .filter((item) => item.id !== product?.id)
    .slice(0, 4)

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (query.isError || !product) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-muted-foreground">
          Не удалось загрузить товар.{' '}
          <Link
            to="/catalog"
            search={{
              categoryId: undefined,
              search: undefined,
              status: undefined,
              sortBy: undefined,
              page: undefined,
              priceMin: undefined,
              priceMax: undefined,
            }}
            className="text-foreground underline"
          >
            ← В каталог
          </Link>
        </p>
      </div>
    )
  }

  const isFavorite = favorites.has(product.id)
  const inCompare = compare.has(product.id)
  const inCart = cart.has(product.id)

  return (
    <>
    <MarketplaceShell>
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        to="/catalog"
        search={{
          categoryId: undefined,
          search: undefined,
          status: undefined,
          sortBy: undefined,
          page: undefined,
          priceMin: undefined,
          priceMax: undefined,
        }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← К каталогу
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          {product.images.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-muted">
              <img
                src={product.images[0].url}
                alt={product.images[0].alt ?? product.title}
                className="aspect-square w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-muted-foreground">
              Нет фото
            </div>
          )}
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.slice(1).map((image) => (
                <img
                  key={image.id}
                  src={image.url}
                  alt={image.alt ?? product.title}
                  className="h-20 w-20 rounded-md object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={productStatusTone(product.status)}>
              {productStatusLabel[product.status]}
            </Badge>
            {product.vendorVerificationTier === 'pro' && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                ★ Pro поставщик
              </Badge>
            )}
            {product.vendorVerificationTier === 'basic' && (
              <Badge variant="secondary" className="text-emerald-700">
                ✓ Проверенный поставщик
              </Badge>
            )}
            {product.volumeDiscountPercent !== null && (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Скидки до {product.volumeDiscountPercent}%
              </Badge>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-semibold leading-tight">{product.title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {product.brand && <span>Бренд: {product.brand}</span>}
              {product.sku && <span>SKU: {product.sku}</span>}
              {product.year && <span>Год: {product.year}</span>}
              <span>{product.views} просмотров</span>
            </div>
          </div>

          <div>
            <div className="text-3xl font-bold text-foreground">
              {formatPrice(product.mainPrice, product.currency)}
            </div>
            {product.leadTime && (
              <p className="mt-1 text-sm text-muted-foreground">Срок поставки: {product.leadTime}</p>
            )}
          </div>

          {/* Buyer actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isFavorite ? 'default' : 'outline'}
              size="sm"
              onClick={() => favorites.toggle(product.id)}
              aria-pressed={isFavorite}
            >
              <HugeiconsIcon icon={FavouriteCircleIcon} className="mr-1 size-4" />
              {isFavorite ? 'В избранном' : 'В избранное'}
            </Button>
            <Button
              variant={inCompare ? 'default' : 'outline'}
              size="sm"
              onClick={() => compare.toggle(product.id)}
              aria-pressed={inCompare}
            >
              {inCompare ? 'В сравнении' : 'Сравнить'}
            </Button>
            {inCart ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/cart">В корзине →</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => cart.add(product.id)}>
                В корзину
              </Button>
            )}
          </div>

          {/* Volume tiers */}
          {product.prices.filter((p) => p.type === 'volume').length > 0 && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <h2 className="text-sm font-semibold">Цены по объёму</h2>
                {product.prices
                  .filter((p) => p.type === 'volume')
                  .map((tier) => (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        от {tier.volumeFrom}
                        {tier.volumeTo ? ` до ${tier.volumeTo}` : '+'} шт.
                      </span>
                      <span className="font-medium">
                        {formatPrice(tier.price, tier.currency)}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {product.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Описание</h2>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          {product.conditionNote && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Состояние</h2>
              <p className="text-sm text-muted-foreground">{product.conditionNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Attributes */}
      {product.attributes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Характеристики</h2>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {product.attributes.map((attr) => (
                <div key={attr.id} className="flex justify-between border-b py-1">
                  <dt className="text-muted-foreground">{attr.attributeName}</dt>
                  <dd className="font-medium">
                    {formatAttributeValue(attr.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Vendor block */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="text-sm font-semibold">{product.vendorName}</h2>
            <p className="text-sm text-muted-foreground">
              Рейтинг: {product.vendorRating.toFixed(1)} · Сделок: {product.vendorTotalDeals}
            </p>
          </div>
          <RfqButton product={product} />
        </CardContent>
      </Card>

      {/* Similar products */}
      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Похожие товары</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
    <ProductReviews productId={product.id} />
    </MarketplaceShell>
    </>
  )
}

function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
