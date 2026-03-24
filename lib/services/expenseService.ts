import { supabaseAdmin } from '@/lib/supabaseClient'
import type { Expense, InsertExpense } from '@/types/models'

export async function insertExpense(data: InsertExpense): Promise<Expense> {
  const { data: expense, error } = await supabaseAdmin
    .from('expenses')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return expense as Expense
}

export async function fetchExpensesByUser(userId: string): Promise<Expense[]> {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Expense[]
}

export async function fetchExpensesByUserAndMonth(
  userId: string,
  year: number,
  month: number
): Promise<Expense[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', end)
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Expense[]
}
