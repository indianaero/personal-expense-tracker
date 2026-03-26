import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { Expense, InsertExpense } from '@/types/models'
import type { UpdateExpenseInput } from '@/lib/schemas/expense'

export const fetchExpensesByUser = cache(async (userId: string): Promise<Expense[]> => {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Expense[]
})

export const fetchExpensesByUserAndMonth = cache(async (
  userId: string,
  year: number,
  month: number,
): Promise<Expense[]> => {
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
})

export const fetchExpenseById = cache(async (
  id: string,
  userId: string,
): Promise<Expense | null> => {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data as Expense
})

export async function insertExpense(data: InsertExpense): Promise<Expense> {
  const { data: expense, error } = await supabaseAdmin
    .from('expenses')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return expense as Expense
}

export async function updateExpense(
  id: string,
  userId: string,
  data: UpdateExpenseInput,
): Promise<Expense | null> {
  const { data: expense, error } = await supabaseAdmin
    .from('expenses')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return expense as Expense
}

export async function deleteExpense(id: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
