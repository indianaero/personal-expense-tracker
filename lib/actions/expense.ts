'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { CreateExpenseSchema, UpdateExpenseSchema } from '@/lib/schemas/expense'
import { insertExpense, updateExpense, deleteExpense } from '@/lib/services/expenseService'
import type { ActionState } from './types'
import type { Expense } from '@/types/models'
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/schemas/expense'

export async function createExpenseAction(
  _prev: ActionState<Expense>,
  input: CreateExpenseInput,
): Promise<ActionState<Expense>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const result = CreateExpenseSchema.safeParse(input)
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
    const expense = await insertExpense({
      ...result.data,
      notes: result.data.notes ?? null,
      user_id: session.user.id,
    })
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success', data: expense }
  } catch (err) {
    console.error('[createExpenseAction] Failed to insert:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}

export async function updateExpenseAction(
  _prev: ActionState<Expense>,
  input: UpdateExpenseInput & { id: string },
): Promise<ActionState<Expense>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const { id, ...rest } = input
  const result = UpdateExpenseSchema.safeParse(rest)
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
    const expense = await updateExpense(id, session.user.id, result.data)
    if (!expense) return { status: 'error', error: 'Expense not found.' }
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success', data: expense }
  } catch (err) {
    console.error('[updateExpenseAction] Failed to update:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}

export async function deleteExpenseAction(
  input: { id: string },
): Promise<ActionState> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  try {
    await deleteExpense(input.id, session.user.id)
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success' }
  } catch (err) {
    console.error('[deleteExpenseAction] Failed to delete:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
