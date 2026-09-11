import type { UserRole } from '@prommarket/contracts'

export type UserRoutePath = '/app' | '/app/profile' | '/app/settings'
export type AdminRoutePath = '/admin' | '/admin/users' | '/admin/settings' | '/admin/verification' | '/admin/billing' | '/admin/analytics'
export type VendorRoutePath =
  | '/vendor'
  | '/vendor/products'
  | '/vendor/billing'
  | '/vendor/credits'
  | '/vendor/verify'
  | '/vendor/featured'
  | '/vendor/add-ons'
export type BrokerRoutePath = '/broker' | '/broker/fees'
export type BuyerRoutePath = '/buyer'
export type ModeratorRoutePath = '/moderator/verification'
export type WorkspaceRoutePath =
  | UserRoutePath
  | AdminRoutePath
  | VendorRoutePath
  | BrokerRoutePath
  | BuyerRoutePath
  | ModeratorRoutePath

const navigationByRole = {
  user: [
    { label: 'Главная', to: '/app' },
    { label: 'Профиль', to: '/app/profile' },
    { label: 'Настройки', to: '/app/settings' },
  ],
  admin: [
    { label: 'Дашборд', to: '/admin' },
    { label: 'Аналитика', to: '/admin/analytics' },
    { label: 'Пользователи', to: '/admin/users' },
    { label: 'Верификация', to: '/admin/verification' },
    { label: 'Биллинг', to: '/admin/billing' },
    { label: 'Настройки', to: '/admin/settings' },
  ],
  // Marketplace roles (ПромМаркет). Each now has its own workspace shell with
  // role-appropriate destinations; the vendor portal is the richest because
  // subscriptions, lead credits, verification, featured, and add-ons all live
  // there.
  vendor: [
    { label: 'Кабинет', to: '/vendor' },
    { label: 'Товары', to: '/vendor/products' },
    { label: 'Подписка', to: '/vendor/billing' },
    { label: 'Лид-кредиты', to: '/vendor/credits' },
    { label: 'Верификация', to: '/vendor/verify' },
    { label: 'Продвижение', to: '/vendor/featured' },
    { label: 'Модули', to: '/vendor/add-ons' },
  ],
  broker: [
    { label: 'Сделки', to: '/broker' },
    { label: 'Комиссии', to: '/broker/fees' },
  ],
  buyer: [{ label: 'Кабинет', to: '/buyer' }],
  moderator: [{ label: 'Верификация', to: '/moderator/verification' }],
} as const satisfies Record<UserRole, ReadonlyArray<{ label: string; to: WorkspaceRoutePath }>>

export function navigationItemsForRole(role: UserRole) {
  return navigationByRole[role]
}

export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'vendor':
      return '/vendor'
    case 'broker':
      return '/broker'
    case 'buyer':
      return '/buyer'
    case 'moderator':
      return '/moderator/verification'
    case 'user':
    default:
      return '/app'
  }
}

export function resolveRoleDestination(
  role: UserRole,
  pathname: string,
): WorkspaceRoutePath {
  const match = navigationItemsForRole(role).find((item) => item.to === pathname)
  return match?.to ?? (homePathForRole(role) as WorkspaceRoutePath)
}

export function safeReturnPath(role: UserRole, value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  let url: URL
  try {
    url = new URL(value, 'https://app.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://app.invalid') return null
  const destination = navigationItemsForRole(role).find((item) => item.to === url.pathname)
  return destination ? `${url.pathname}${url.search}` : null
}
