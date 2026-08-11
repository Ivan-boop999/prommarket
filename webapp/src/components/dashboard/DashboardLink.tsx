import { Link } from '@tanstack/react-router'
import {
  forwardRef,
  type ComponentPropsWithoutRef,
} from 'react'

import { useSidebar } from '@/components/ui/sidebar'

type DashboardLinkProps = Omit<
  ComponentPropsWithoutRef<'a'>,
  'className' | 'href' | 'style'
> & {
  to: string
}

export const DashboardLink = forwardRef<HTMLAnchorElement, DashboardLinkProps>(
  function DashboardLink({ onClick, to, ...props }, ref) {
    const { setOpenMobile } = useSidebar()

    return (
      <Link
        {...props}
        activeOptions={{ exact: true }}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) setOpenMobile(false)
        }}
        ref={ref}
        to={to}
      />
    )
  },
)
