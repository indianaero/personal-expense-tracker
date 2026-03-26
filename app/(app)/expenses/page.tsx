import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { fetchExpensesByUser } from '@/lib/services/expenseService'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { ExpensesView } from '@/components/expenses/ExpensesView'

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const [expenses, categories] = await Promise.all([
    fetchExpensesByUser(session.user.id),
    fetchCategoriesByUser(session.user.id),
  ])

  return <ExpensesView expenses={expenses} categories={categories} />
}
