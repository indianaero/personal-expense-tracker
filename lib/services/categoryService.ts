import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { Category } from '@/types/models'

export const fetchCategoriesByUser = cache(async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .eq('is_archived', false)
    .order('name')

  if (error) throw error
  return (data ?? []) as Category[]
})
