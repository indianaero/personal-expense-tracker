'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { UpdateUserSchema } from '@/lib/schemas/user'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { ActionState } from './types'
import type { User } from '@/types/models'

export async function updateProfileAction(
  _prev: ActionState<Pick<User, 'name'>>,
  input: { name: string },
): Promise<ActionState<Pick<User, 'name'>>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const result = UpdateUserSchema.pick({ name: true }).safeParse(input)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ name: result.data.name })
      .eq('id', session.user.id)
      .select('name')
      .single()

    if (error) throw error
    revalidatePath('/settings')
    return { status: 'success', data: data as Pick<User, 'name'> }
  } catch (err) {
    console.error('[updateProfileAction] Failed to update name:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}

export async function updateCurrencyAction(
  _prev: ActionState<Pick<User, 'currency'>>,
  input: { currency: string },
): Promise<ActionState<Pick<User, 'currency'>>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const result = UpdateUserSchema.pick({ currency: true }).safeParse(input)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ currency: result.data.currency })
      .eq('id', session.user.id)
      .select('currency')
      .single()

    if (error) throw error
    revalidatePath('/settings')
    return { status: 'success', data: data as Pick<User, 'currency'> }
  } catch (err) {
    console.error('[updateCurrencyAction] Failed to update currency:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
