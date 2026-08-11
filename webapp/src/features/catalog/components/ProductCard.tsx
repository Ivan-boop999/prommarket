import type { ProductListItem } from '@web-app-demo/contracts'
import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
 */
export function ProductCard({ product }: { product: ProductListItem }) {
  const image = product.primaryImage
  return (
    <Link to="/catalog/$productId" params={{ productId: product.id }} className="block">
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
            {product.vendorVerified && (
              <Badge variant="secondary" className="text-xs">
                ✓ Проверен
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
