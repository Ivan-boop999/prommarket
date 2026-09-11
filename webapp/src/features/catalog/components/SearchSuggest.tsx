import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { formatPrice } from '../model'
import { searchCatalog } from '../api'

/**
 * Search input with Avito-style suggestions (categories + product hits from
 * GET /api/catalog/search, debounced 250 ms).
 *
 * Two commit modes:
 * - `onCommit` (catalog page): reports the raw query so the page can update its
 *   URL search state; suggestion picks still navigate directly.
 * - default (home page): submit navigates to /catalog?search=….
 */
export function SearchSuggest({
  defaultValue = '',
  placeholder = 'Поиск оборудования, товаров, брендов…',
  className,
  buttonLabel,
  onCommit,
}: {
  defaultValue?: string
  placeholder?: string
  className?: string
  buttonLabel?: string
  onCommit?: (query: string) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(defaultValue)
  const [debounced, setDebounced] = useState(defaultValue.trim())
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const suggestionsQuery = useQuery({
    queryKey: ['catalog', 'suggest', debounced],
    queryFn: () => searchCatalog({ query: debounced, page: 1, pageSize: 5 }),
    enabled: open && debounced.length >= 2,
  })

  const categories = suggestionsQuery.data?.categories ?? []
  const products = suggestionsQuery.data?.products ?? []
  const items = [
    ...categories.map((hit) => ({ kind: 'category' as const, id: hit.id, hit })),
    ...products.map((hit) => ({ kind: 'product' as const, id: hit.id, hit })),
  ]
  const showDropdown = open && debounced.length >= 2

  const goToCatalog = (patch: Record<string, string | undefined>) => {
    void navigate({
      to: '/catalog',
      search: {
        categoryId: undefined,
        search: undefined,
        status: undefined,
        sortBy: undefined,
        page: undefined,
        priceMin: undefined,
        priceMax: undefined,
        ...patch,
      },
    })
  }

  const submit = (rawQuery: string) => {
    const q = rawQuery.trim()
    setOpen(false)
    setActiveIndex(-1)
    if (onCommit) onCommit(q)
    else goToCatalog(q ? { search: q } : {})
  }

  const pickItem = (index: number) => {
    const item = items[index]
    if (!item) return
    setOpen(false)
    setActiveIndex(-1)
    if (item.kind === 'category') {
      goToCatalog({ categoryId: item.id, search: debounced || undefined })
    } else {
      void navigate({ to: '/catalog/$productId', params: { productId: item.id } })
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => (prev + 1) % items.length)
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (activeIndex >= 0) pickItem(activeIndex)
      else submit(query)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const handleBlur = () => {
    // Delay so a click on a suggestion row registers before the dropdown dies.
    blurTimer.current = setTimeout(() => {
      setOpen(false)
      setActiveIndex(-1)
    }, 150)
  }
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setOpen(true)
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-10"
            aria-label="Поиск по каталогу"
          />
        </div>
        {buttonLabel && (
          <Button type="button" onClick={() => submit(query)}>
            {buttonLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" />
          </Button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-card shadow-lg">
          {suggestionsQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Ничего не найдено по «{debounced}»
            </div>
          ) : (
            <ul className="max-h-96 overflow-auto py-1">
              {categories.length > 0 && (
                <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Категории
                </li>
              )}
              {categories.map((hit, i) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                      activeIndex === i && 'bg-accent',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickItem(i)}
                  >
                    <span className="text-muted-foreground">📁</span>
                    <span className="flex-1 truncate">В категории «{hit.name}»</span>
                    <span className="text-xs text-muted-foreground">{hit.productCount}</span>
                  </button>
                </li>
              ))}
              {products.length > 0 && (
                <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Товары
                </li>
              )}
              {products.map((hit) => {
                const index = categories.length + products.indexOf(hit)
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent',
                        activeIndex === index && 'bg-accent',
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickItem(index)}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-xs text-muted-foreground">
                        {hit.primaryImage ? (
                          <img
                            src={hit.primaryImage.url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          'Нет фото'
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{hit.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {hit.vendorName}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatPrice(hit.mainPrice, hit.currency)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
