import {
  DashboardSquare01Icon,
  Home01Icon,
  Settings01Icon,
  UserGroupIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { useLocation } from '@tanstack/react-router'
import type { UserDto } from '@web-app-demo/contracts'
import type { PropsWithChildren } from 'react'

import {
  AppSidebar,
  type DashboardNavigationItem,
  SiteHeader,
} from '@/components/dashboard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import {
  homePathForRole,
  navigationItemsForRole,
} from '@/features/navigation'

const iconsByPath = {
  '/app': Home01Icon,
  '/app/profile': UserIcon,
  '/app/settings': Settings01Icon,
  '/admin': DashboardSquare01Icon,
  '/admin/users': UserGroupIcon,
  '/admin/settings': Settings01Icon,
  '/admin/verification': UserGroupIcon,
  '/admin/billing': DashboardSquare01Icon,
  // Vendor workspace (ПромМаркет). Icons reuse the safe set already imported;
  // a later pass can swap in more specific glyphs once the icon set is verified.
  '/vendor': Home01Icon,
  '/vendor/billing': DashboardSquare01Icon,
  '/vendor/credits': DashboardSquare01Icon,
  '/vendor/verify': UserGroupIcon,
  '/vendor/featured': Home01Icon,
  '/vendor/add-ons': DashboardSquare01Icon,
  // Broker workspace.
  '/broker': DashboardSquare01Icon,
  '/broker/fees': DashboardSquare01Icon,
  // Buyer workspace.
  '/buyer': Home01Icon,
  // Moderator workspace.
  '/moderator/verification': UserGroupIcon,
} as const

function getSidebarDefaultOpen() {
  const persistedState = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('sidebar_state='))
    ?.slice('sidebar_state='.length)

  return persistedState !== 'false'
}

export function WorkspaceShell({
  children,
  onLogout,
  user,
}: PropsWithChildren<{
  onLogout: () => Promise<void>
  user: UserDto
}>) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigationItems = navigationItemsForRole(user.role)
  const activeItem = navigationItems.find((item) => item.to === pathname)
  const homePath = homePathForRole(user.role)
  const settingsPath = user.role === 'admin' ? '/admin/settings' : '/app/settings'
  const items: ReadonlyArray<DashboardNavigationItem> = navigationItems.map((item) => ({
    ...item,
    icon: iconsByPath[item.to as keyof typeof iconsByPath],
    isActive: item.to === pathname,
  }))

  const workspaceLabel = workspaceLabelForRole(user.role)

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar
        accountPath={user.role === 'user' ? '/app/profile' : undefined}
        homePath={homePath}
        items={items}
        onLogout={onLogout}
        settingsPath={settingsPath}
        user={user}
        workspaceLabel={workspaceLabel}
      />
      <SidebarInset>
        <SiteHeader
          title={activeItem?.label ?? homePath}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function workspaceLabelForRole(role: UserDto['role']): string {
  switch (role) {
    case 'admin':
      return 'Администрирование'
    case 'vendor':
      return 'Кабинет поставщика'
    case 'broker':
      return 'Кабинет брокера'
    case 'buyer':
      return 'Кабинет покупателя'
    case 'moderator':
      return 'Модерация'
    case 'user':
    default:
      return 'Личный кабинет'
  }
}
