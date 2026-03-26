import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@heroui/react'

export default async function PublicPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">Expense Tracker</h1>
      <p className="text-default-500 max-w-sm">
        Track your spending, understand your habits, and stay on top of your finances.
      </p>
      <div className="flex gap-3">
        <Button as={Link} href="/login" color="primary">
          Sign in
        </Button>
        <Button as={Link} href="/register" variant="bordered">
          Create account
        </Button>
      </div>
    </div>
  )
}
