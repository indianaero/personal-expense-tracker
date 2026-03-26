'use client'
import { Listbox, ListboxItem } from '@heroui/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Tag, BarChart2, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dashboard',  Icon: LayoutDashboard },
  { label: 'Expenses',   href: '/expenses',   Icon: Receipt },
  { label: 'Categories', href: '/categories', Icon: Tag },
  { label: 'Reports',    href: '/reports',    Icon: BarChart2 },
  { label: 'Settings',   href: '/settings',   Icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  const activeKey = NAV_ITEMS.find((item) =>
    pathname.startsWith(item.href)
  )?.href ?? ''

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-divider py-4">
      <Listbox
        aria-label="Navigation"
        selectionMode="single"
        selectedKeys={new Set([activeKey])}
        disallowEmptySelection={false}
      >
        {NAV_ITEMS.map(({ label, href, Icon }) => (
          <ListboxItem
            key={href}
            as={Link}
            href={href}
            startContent={<Icon size={18} />}
            color={activeKey === href ? 'primary' : 'default'}
            className={activeKey === href ? 'text-primary' : ''}
          >
            {label}
          </ListboxItem>
        ))}
      </Listbox>
    </aside>
  )
}
