import { Link } from '@tanstack/react-router'
import { FactoryIcon, FavouriteCircleIcon, Home01Icon, Search01Icon, ShoppingBag01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCart, useFavorites } from '@/lib/use-local-collection'
import { SearchSuggest } from '@/features/catalog'

/**
 * Public marketplace chrome: sticky header (logo, search, favorites/cart with
 * live counters, sign-in) and a dark footer. Wraps the home page now; other
 * public surfaces adopt it incrementally instead of growing local headers.
 */
export function MarketplaceShell({
  children,
  className,
  showHeaderSearch = true,
  searchDefaultValue = '',
}: {
  children: React.ReactNode
  className?: string
  showHeaderSearch?: boolean
  searchDefaultValue?: string
}) {
  const favorites = useFavorites()
  const cart = useCart()

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HugeiconsIcon icon={FactoryIcon} className="size-5" />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-base font-bold tracking-tight">ПромМаркет</span>
              <span className="text-[11px] text-muted-foreground">Маркетплейс оборудования</span>
            </span>
          </Link>

          {showHeaderSearch && (
            <div className="mx-2 hidden min-w-0 flex-1 md:block">
              <SearchSuggest
                key={searchDefaultValue}
                defaultValue={searchDefaultValue}
                placeholder="Поиск оборудования, товаров, брендов…"
              />
            </div>
          )}
          <div className={cn('flex flex-1 items-center justify-end gap-1', showHeaderSearch && 'md:flex-none')}>
            <Button variant="ghost" size="sm" asChild className="relative">
              <Link to="/favorites" aria-label="Избранное">
                <HugeiconsIcon icon={FavouriteCircleIcon} className="size-5" />
                {favorites.count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                    {favorites.count}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="relative">
              <Link to="/cart" aria-label="Корзина">
                <HugeiconsIcon icon={ShoppingBag01Icon} className="size-5" />
                {cart.count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {cart.count}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/login" search={{ returnTo: undefined }}>
                Войти
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={className}>{children}</main>

      <footer className="mt-16 border-t bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <HugeiconsIcon icon={FactoryIcon} className="size-4" />
              </span>
              <span className="text-base font-bold text-white">ПромМаркет</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Маркетплейс промышленного оборудования: надёжные поставщики,
              проверенные товары, прямые сделки — для бизнеса и частных лиц.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Покупателям</h3>
            <ul className="space-y-2 text-sm">
              <li><Link className="hover:text-white" to="/catalog" search={{ categoryId: undefined, search: undefined, status: undefined, sortBy: undefined, page: undefined, priceMin: undefined, priceMax: undefined }}>Каталог</Link></li>
              <li><Link className="hover:text-white" to="/favorites">Избранное</Link></li>
              <li><Link className="hover:text-white" to="/cart">Корзина</Link></li>
              <li><Link className="hover:text-white" to="/compare">Сравнение товаров</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Поставщикам</h3>
            <ul className="space-y-2 text-sm">
              <li><Link className="hover:text-white" to="/signup" search={{ returnTo: undefined }}>Стать поставщиком</Link></li>
              <li><Link className="hover:text-white" to="/signup" search={{ returnTo: undefined }}>Верификация</Link></li>
              <li><Link className="hover:text-white" to="/signup" search={{ returnTo: undefined }}>Тарифы и продвижение</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Контакты</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>info@prommarket.ru</li>
              <li>+7 (495) 000-00-00</li>
              <li className="flex items-center gap-1 pt-1">
                <HugeiconsIcon icon={Home01Icon} className="size-4" />
                Москва, Россия
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row">
            <span>© 2026 ПромМаркет · маркетплейс промышленного оборудования</span>
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Search01Icon} className="size-3.5" />
              Работает на движке ПромМаркет
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
