import { supabaseAdmin } from '@/lib/supabaseClient'
import type { CategoryBreakdown, MonthlySummary } from '@/types/models'

/**
 * Compute a monthly summary by aggregating directly from the expenses table.
 * Returns null when no expenses exist for the requested period.
 */
export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number
): Promise<MonthlySummary | null> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('amount, category_id')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', end)

  if (error) throw error
  if (!data || data.length === 0) return null

  const totalSpent = data.reduce((sum, e) => sum + Number(e.amount), 0)
  const expenseCount = data.length

  const categoryMap = new Map<string, { total: number; count: number }>()
  for (const e of data) {
    const prev = categoryMap.get(e.category_id) ?? { total: 0, count: 0 }
    categoryMap.set(e.category_id, {
      total: prev.total + Number(e.amount),
      count: prev.count + 1,
    })
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(
    categoryMap.entries()
  ).map(([category_id, stats]) => ({ category_id, ...stats }))

  return {
    user_id: userId,
    year,
    month,
    total_spent: totalSpent,
    expense_count: expenseCount,
    category_breakdown: categoryBreakdown,
    updated_at: new Date().toISOString(),
  }
}
