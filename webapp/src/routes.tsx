import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { RootLayout } from './root-layout'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: lazyRouteComponent(() => import('./pages'), 'NotFoundPage'),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages'), 'HomePage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'LoginPage'),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'SignupPage'),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: lazyRouteComponent(() => import('./pages'), 'ForgotPasswordPage'),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(() => import('./pages'), 'ResetPasswordPage'),
})

// Public marketplace routes. No auth guard: a buyer must be able to browse the
// catalog before signing in. Filter state lives in the URL via validateSearch
// so catalog URLs are shareable and back/forward works natively.
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  validateSearch: catalogSearchParser,
  component: lazyRouteComponent(() => import('./pages'), 'CatalogPageWrapper'),
})

const productDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog/$productId',
  component: lazyRouteComponent(() => import('./pages'), 'ProductDetailPageWrapper'),
})

const userWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'userWorkspace',
  component: lazyRouteComponent(() => import('./pages'), 'UserWorkspaceLayout'),
})

const userHomeRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app',
  component: lazyRouteComponent(() => import('./pages'), 'UserHomePage'),
})

const userProfileRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/profile',
  component: lazyRouteComponent(() => import('./pages'), 'UserProfilePage'),
})

const userSettingsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/settings',
  component: lazyRouteComponent(() => import('./pages'), 'UserSettingsPage'),
})

const adminWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'adminWorkspace',
  component: lazyRouteComponent(() => import('./pages'), 'AdminWorkspaceLayout'),
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin',
  component: lazyRouteComponent(() => import('./pages'), 'AdminDashboardPage'),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/users',
  component: lazyRouteComponent(() => import('./pages'), 'AdminUsersPage'),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/settings',
  component: lazyRouteComponent(() => import('./pages'), 'AdminSettingsPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  catalogRoute,
  productDetailRoute,
  userWorkspaceRoute.addChildren([
    userHomeRoute,
    userProfileRoute,
    userSettingsRoute,
  ]),
  adminWorkspaceRoute.addChildren([
    adminDashboardRoute,
    adminUsersRoute,
    adminSettingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

function returnToSearch(search: Record<string, unknown>) {
  return {
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }
}

/**
 * Catalog filter state derived from URL search params. All fields are optional
 * so a bare `/catalog` URL loads the unfiltered first page. `page` is coerced
 * to a number and clamped to >=1 so a malformed link cannot request page 0.
 */
function catalogSearchParser(search: Record<string, unknown>) {
  const page =
    typeof search.page === 'string' && /^\d+$/.test(search.page)
      ? Math.max(1, Number(search.page))
      : typeof search.page === 'number'
        ? Math.max(1, Math.floor(search.page))
        : undefined
  return {
    categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
    search: typeof search.search === 'string' ? search.search : undefined,
    status: typeof search.status === 'string' ? search.status : undefined,
    sortBy: typeof search.sortBy === 'string' ? search.sortBy : undefined,
    page,
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
