import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { fetchUserById } from '@/lib/services/userService'
import { SettingsView } from '@/components/settings/SettingsView'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await fetchUserById(session.user.id)
  if (!user) redirect('/login')

  return (
    <SettingsView
      name={user.name}
      email={user.email}
      currency={user.currency ?? 'USD'}
    />
  )
}
