import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth/config'
import { redirect }         from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <>{children}</>
}
