'use server'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth/session'
import { CreateCategorySchema, UpdateCategorySchema } from '@/lib/schemas/category'
import { insertCategory, updateCategory } from '@/lib/services/categoryService'
import type { ActionState } from './types'
import type { Category } from '@/types/models'
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/schemas/category'

export async function createCategoryAction(
  _prev: ActionState<Category>,
  input: CreateCategoryInput,
): Promise<ActionState<Category>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const result = CreateCategorySchema.safeParse(input)
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
    const category = await insertCategory({
      user_id: session.user.id,
      name: result.data.name,
      is_default: result.data.is_default ?? false,
    })
    revalidatePath('/categories')
    revalidatePath('/expenses')
    return { status: 'success', data: category }
  } catch (err) {
    console.error('[createCategoryAction] Failed to insert:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}

export async function updateCategoryAction(
  _prev: ActionState<Category>,
  input: UpdateCategoryInput & { id: string },
): Promise<ActionState<Category>> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const { id, ...rest } = input
  const result = UpdateCategorySchema.safeParse(rest)
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
    const category = await updateCategory(id, session.user.id, result.data)
    if (!category) return { status: 'error', error: 'Category not found.' }
    revalidatePath('/categories')
    revalidatePath('/expenses')
    return { status: 'success', data: category }
  } catch (err) {
    console.error('[updateCategoryAction] Failed to update:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}

export async function archiveCategoryAction(
  input: { id: string; archive: boolean },
): Promise<ActionState> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  try {
    const category = await updateCategory(input.id, session.user.id, {
      is_archived: input.archive,
    })
    if (!category) return { status: 'error', error: 'Category not found.' }
    revalidatePath('/categories')
    revalidatePath('/expenses')
    return { status: 'success' }
  } catch (err) {
    console.error('[archiveCategoryAction] Failed to archive:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
