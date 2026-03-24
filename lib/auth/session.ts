import 'server-only'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import type { Session } from 'next-auth'

export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error('UNAUTHENTICATED')
  }

  return session
}
