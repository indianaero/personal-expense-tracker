import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { User } from '@/types/models'

export const fetchUserById = cache(async (userId: string): Promise<User | null> => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, currency, provider, created_at, updated_at')
    .eq('id', userId)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data as User
})
