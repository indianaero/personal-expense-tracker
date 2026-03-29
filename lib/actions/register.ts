'use server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { RegisterSchema } from '@/lib/schemas'
import bcrypt             from 'bcryptjs'
import type { ActionState } from './types'

type RegisterSuccess = { email: string; password: string }

export async function registerAction(
  _prev: ActionState<RegisterSuccess>,
  formData: FormData,
): Promise<ActionState<RegisterSuccess>> {
  const result = RegisterSchema.safeParse({
    name:            formData.get('name'),
    email:           formData.get('email'),
    password:        formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  const { name, email, password } = result.data

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return {
      status: 'error',
      error:  'Please fix the errors below.',
      fields: { email: ['An account with this email already exists.'] },
    }
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { error: insertError } = await supabaseAdmin
    .from('users')
    .insert({ name, email, password_hash, provider: 'credentials', currency: 'USD' })

  if (insertError) {
    console.error('[registerAction] Failed to insert user:', insertError.message)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }

  return { status: 'success', data: { email, password } }
}
