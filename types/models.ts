// Supabase / PostgreSQL types — snake_case to match column names

export interface User {
  id: string
  email: string
  name: string
  password_hash: string | null
  provider: 'credentials' | 'google'
  currency: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  is_default: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  category_id: string
  amount: number
  description: string
  notes: string | null
  date: string
  is_recurring: boolean
  created_at: string
  updated_at: string
}

export type InsertExpense = Omit<Expense, 'id' | 'created_at' | 'updated_at'>

export interface CategoryBreakdown {
  category_id: string
  total: number
  count: number
}

export interface MonthlySummary {
  user_id: string
  year: number
  month: number
  total_spent: number
  expense_count: number
  category_breakdown: CategoryBreakdown[]
  updated_at: string
}
