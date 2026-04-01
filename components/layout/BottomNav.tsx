'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Tabs, Tab } from '@heroui/react'
import { LayoutDashboard, Receipt, Tag, BarChart2, CalendarDays } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  Icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/expenses',   Icon: Receipt,          label: 'Expenses' },
  { href: '/categories', Icon: Tag,              label: 'Categories' },
  { href: '/reports',    Icon: BarChart2,         label: 'Reports' },
  { href: '/summary',    Icon: CalendarDays,      label: 'Summary' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const activeKey = NAV_ITEMS.find((item) =>
    pathname.startsWith(item.href)
  )?.href ?? '/dashboard'

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-divider bg-background/80 backdrop-blur-md">
      <Tabs
        aria-label="Bottom navigation"
        variant="light"
        fullWidth
        selectedKey={activeKey}
        onSelectionChange={(key) => router.push(key as string)}
      >
        {NAV_ITEMS.map(({ href, Icon, label }) => (
          <Tab
            key={href}
            title={
              <div className="flex flex-col items-center gap-0.5 py-1">
                <Icon size={20} />
                <span className="text-[10px]">{label}</span>
              </div>
            }
          />
        ))}
      </Tabs>
    </nav>
  )
}
