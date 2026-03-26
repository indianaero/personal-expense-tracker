import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { getMonthlySummary } from '@/lib/services/summaryService'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { fetchExpensesByUser } from '@/lib/services/expenseService'
import { DashboardView } from '@/components/dashboard/DashboardView'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [summary, categories, allExpenses] = await Promise.all([
    getMonthlySummary(session.user.id, year, month),
    fetchCategoriesByUser(session.user.id),
    fetchExpensesByUser(session.user.id),
  ])

  return (
    <DashboardView
      summary={summary}
      categories={categories}
      allExpenses={allExpenses}
      year={year}
      month={month}
    />
  )
}
