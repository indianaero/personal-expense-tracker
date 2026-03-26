'use client'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarMenuItem,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner,
} from '@heroui/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dashboard' },
  { label: 'Expenses',   href: '/expenses' },
  { label: 'Categories', href: '/categories' },
  { label: 'Reports',    href: '/reports' },
  { label: 'Settings',   href: '/settings' },
]

export function AppNavbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  return (
    <Navbar isBlurred isBordered={false} className="z-40">
      <NavbarContent>
        <NavbarMenuToggle className="lg:hidden" />
        <NavbarBrand>
          <Link href="/" className="font-semibold text-foreground">
            ExpenseTracker
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden lg:flex gap-4" justify="center">
        <NavbarItem>
          <Link
            href="/expenses"
            className={
              pathname.startsWith('/expenses')
                ? 'text-primary font-medium'
                : 'text-foreground'
            }
          >
            Expenses
          </Link>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        {status === 'loading' ? (
          <Spinner size="sm" />
        ) : (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                as="button"
                name={session?.user?.name ?? session?.user?.email ?? 'U'}
                size="sm"
                className="cursor-pointer"
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="email" isReadOnly className="opacity-60 cursor-default">
                {session?.user?.email ?? ''}
              </DropdownItem>
              <DropdownItem
                key="signout"
                color="danger"
                className="text-danger"
                onPress={() => signOut({ callbackUrl: '/login' })}
              >
                Sign out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </NavbarContent>

      {/* Mobile slide-in menu */}
      <NavbarMenu>
        {NAV_ITEMS.map((item) => (
          <NavbarMenuItem key={item.href}>
            <Link
              href={item.href}
              className={
                pathname.startsWith(item.href)
                  ? 'text-primary font-medium'
                  : 'text-foreground'
              }
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  )
}
