import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { AppNavbar } from '@/components/layout/AppNavbar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1">
        <AppNavbar />

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />

          <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
