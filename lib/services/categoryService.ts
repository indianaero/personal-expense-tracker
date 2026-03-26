import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { Category } from '@/types/models'
import type { UpdateCategoryInput } from '@/lib/schemas/category'

// Fetches user-owned + global defaults, all archive states (page filters client-side)
export const fetchCategoriesByUser = cache(async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .order('name')

  if (error) throw error
  return (data ?? []) as Category[]
})

export async function insertCategory(data: {
  user_id: string
  name: string
  is_default: boolean
}): Promise<Category> {
  const { data: category, error } = await supabaseAdmin
    .from('categories')
    .insert({ ...data, is_archived: false })
    .select()
    .single()

  if (error) throw error
  return category as Category
}

export async function updateCategory(
  id: string,
  userId: string,
  data: UpdateCategoryInput,
): Promise<Category | null> {
  const { data: category, error } = await supabaseAdmin
    .from('categories')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return category as Category
}
