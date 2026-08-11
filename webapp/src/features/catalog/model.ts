import type { ProductStatus } from '@web-app-demo/contracts'

/** Format a decimal-string price in RUB with Russian grouping. */
export function formatPrice(value: string | null, currency = 'RUB'): string {
  if (value === null) return 'Цена по запросу'
  const number = Number(value)
  if (Number.isNaN(number)) return value
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(number)
  } catch {
    return `${number.toLocaleString('ru-RU')} ${currency}`
  }
}

export const productStatusLabel: Record<ProductStatus, string> = {
  new: 'Новое',
  used: 'Б/у',
  refurbished: 'Восстановлено',
  spare_parts: 'Запчасти',
  storage: 'На складе',
}

/** Tailwind-friendly status → badge tone. */
export function productStatusTone(status: ProductStatus): string {
  switch (status) {
    case 'new':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    case 'used':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    case 'refurbished':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
    case 'spare_parts':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    case 'storage':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
  }
}
