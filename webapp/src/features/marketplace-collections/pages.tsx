import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProduct } from '@/features/catalog'
import { PageContainer, PageHeader } from '@/components/PageLayout'
import { useCart, useCompare, useFavorites } from './use-local-collection'

/**
 * Cart, favorites, and compare pages. All three read product ids from the
 * localStorage-backed collection hooks and resolve them to product details via
 * the public catalog client. They are public surfaces: a buyer can assemble a
 * cart or shortlist before signing in. Submitting an RFQ from the cart is the
 * bridge into the authenticated deals flow (iteration 5).
 */

function useProductsByIds(ids: string[]) {
  return useQuery({
    // One query per id is simpler for a small cart; TanStack Query dedupes.
    queryKey: ['catalog', 'products-by-ids', ids],
    queryFn: async () => {
      const results = await Promise.all(
        ids.map((id) => getProduct(id).catch(() => null)),
      )
      return results.filter((p): p is NonNullable<typeof p> => p !== null)
    },
    enabled: ids.length > 0,
  })
}

function formatPrice(value: string | null | undefined, currency: string): string {
  if (!value) return 'Цена по запросу'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`
}

// ===========================================================================
// CART
// ===========================================================================

export function CartPage() {
  const cart = useCart()
  const productsQuery = useProductsByIds(cart.ids)
  const products = productsQuery.data ?? []

  return (
    <PageContainer>
      <PageHeader title="Корзина" description="Товары для формирования заявки (RFQ)." />
      {cart.count === 0 ? (
        <EmptyState message="Корзина пуста. Добавьте товары из каталога." />
      ) : productsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link to="/catalog/$productId" params={{ productId: p.id }} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.vendorName}</TableCell>
                    <TableCell>{formatPrice(p.mainPrice, p.currency)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => cart.remove(p.id)}>
                        Убрать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {cart.count > 0 && (
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link to="/login" search={{ returnTo: undefined }}>Оформить заявку</Link>
          </Button>
          <Button variant="outline" onClick={() => cart.clear()}>
            Очистить
          </Button>
        </div>
      )}
    </PageContainer>
  )
}

// ===========================================================================
// FAVORITES
// ===========================================================================

export function FavoritesPage() {
  const favorites = useFavorites()
  const productsQuery = useProductsByIds(favorites.ids)
  const products = productsQuery.data ?? []

  return (
    <PageContainer>
      <PageHeader title="Избранное" description="Сохранённые товары для отслеживания." />
      {favorites.count === 0 ? (
        <EmptyState message="В избранном пусто. Отмечайте товары звёздочкой в каталоге." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Card key={p.id}>
              <Link to="/catalog/$productId" params={{ productId: p.id }}>
                <div className="aspect-square bg-muted">
                  {p.primaryImage ? (
                    <img src={p.primaryImage?.url} alt={p.title} className="size-full object-cover" />
                  ) : null}
                </div>
              </Link>
              <CardContent className="p-3">
                <h3 className="line-clamp-2 text-sm font-medium">{p.title}</h3>
                <div className="mt-1 text-sm font-semibold">{formatPrice(p.mainPrice, p.currency)}</div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => favorites.remove(p.id)}>
                  Убрать из избранного
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

// ===========================================================================
// COMPARE
// ===========================================================================

export function ComparePage() {
  const compare = useCompare()
  const productsQuery = useProductsByIds(compare.ids)
  const products = productsQuery.data ?? []

  if (compare.count === 0) {
    return (
      <PageContainer>
        <PageHeader title="Сравнение" description="Сравнивайте товары по характеристикам." />
        <EmptyState message="Добавьте товары к сравнению (до 4 одновременно)." />
      </PageContainer>
    )
  }

  // Build a merged attribute table: rows = attribute names, columns = products.
  const allAttrs = new Map<string, string>()
  for (const p of products) {
    for (const attr of p.attributes) {
      if (!allAttrs.has(attr.attributeName)) {
        allAttrs.set(attr.attributeName, attr.attributeName)
      }
    }
  }
  const attrNames = [...allAttrs.values()]

  return (
    <PageContainer>
      <PageHeader title="Сравнение товаров" description="Сопоставление характеристик выбранных товаров." />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Характеристика</TableHead>
                {products.map((p) => (
                  <TableHead key={p.id}>
                    <Link to="/catalog/$productId" params={{ productId: p.id }} className="hover:underline">
                      {p.title}
                    </Link>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => compare.remove(p.id)}>
                      убрать
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Цена</TableCell>
                {products.map((p) => (
                  <TableCell key={p.id}>{formatPrice(p.mainPrice, p.currency)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Бренд</TableCell>
                {products.map((p) => (
                  <TableCell key={p.id}>{p.brand ?? '—'}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Поставщик</TableCell>
                {products.map((p) => (
                  <TableCell key={p.id}>
                    {p.vendorName}
                    {p.vendorVerified && <Badge variant="secondary" className="ml-1 text-xs">✓</Badge>}
                  </TableCell>
                ))}
              </TableRow>
              {attrNames.map((name) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  {products.map((p) => {
                    const attr = p.attributes.find((a) => a.attributeName === name)
                    return <TableCell key={p.id}>{attr ? formatAttrValue(attr.value) : '—'}</TableCell>
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function formatAttrValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {message}
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/catalog" search={{ categoryId: undefined, search: undefined, status: undefined, sortBy: undefined, page: undefined, priceMin: undefined, priceMax: undefined }}>Перейти в каталог</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
