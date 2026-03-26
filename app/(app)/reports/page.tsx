import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { fetchExpensesByUser } from '@/lib/services/expenseService'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { ReportsView } from '@/components/reports/ReportsView'

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const [expenses, categories] = await Promise.all([
    fetchExpensesByUser(session.user.id),
    fetchCategoriesByUser(session.user.id),
  ])

  return <ReportsView expenses={expenses} categories={categories} />
}
