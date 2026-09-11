import type { ProductListItem } from '@prommarket/contracts'
import { FavouriteCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useFavorites } from '@/features/marketplace-collections'
import { cn } from '@/lib/utils'

import { formatPrice, productStatusLabel, productStatusTone } from '../model'

/**
 * Marketplace product card for the catalog grid.
 *
 * Designed to be cheap to render and self-contained: the parent just passes a
 * `ProductListItem` (the lightweight catalog projection from
 * `paginatedResponseSchema(productListItemSchema)`). Navigation to the detail
 * page goes through TanStack Router's `<Link>` so back/forward and deep-linking
 * work natively, unlike the original's store-based view switching.
 *
 * The favorites heart is a sibling overlay (not a child of the link) so the
 * click never navigates and the HTML stays valid.
 */
export function ProductCard({ product }: { product: ProductListItem }) {
  const favorites = useFavorites()
  const isFavorite = favorites.has(product.id)
  const image = product.primaryImage
  return (
    <div className="group relative h-full">
      <button
        type="button"
        aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        aria-pressed={isFavorite}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          favorites.toggle(product.id)
        }}
        className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1.5 shadow-sm transition-transform hover:scale-110"
      >
        <HugeiconsIcon
          icon={FavouriteCircleIcon}
          className={cn(
            'size-5 transition-colors',
            isFavorite ? 'text-rose-500' : 'text-muted-foreground/70',
          )}
        />
      </button>
      <Link to="/catalog/$productId" params={{ productId: product.id }} className="block h-full">
        <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
          <div className="relative aspect-[4/3] bg-muted">
            {image ? (
              <img
                src={image.url}
                alt={image.alt ?? product.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Нет фото
              </div>
            )}
            {product.volumeDiscountPercent !== null && (
              <Badge className="absolute left-2 top-2 bg-emerald-600 text-white hover:bg-emerald-600">
                −{product.volumeDiscountPercent}%
              </Badge>
            )}
          </div>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className={cn('text-xs', productStatusTone(product.status))}>
                {productStatusLabel[product.status]}
              </Badge>
              <span className="text-xs text-muted-foreground">{product.brand ?? '—'}</span>
            </div>
            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">
              {product.title}
            </h3>
            <div className="mt-auto flex items-end justify-between pt-2">
              <div>
                <div className="text-base font-semibold text-foreground">
                  {formatPrice(product.mainPrice, product.currency)}
                </div>
                <div className="text-xs text-muted-foreground">{product.vendorName}</div>
              </div>
              {product.vendorVerificationTier === 'pro' && (
                <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-600">
                  ★ Pro
                </Badge>
              )}
              {product.vendorVerificationTier === 'basic' && (
                <Badge variant="secondary" className="text-xs text-emerald-700">
                  ✓ Проверен
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
