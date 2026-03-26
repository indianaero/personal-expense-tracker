import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { handleApiError } from '@/lib/api'
import { CreateExpenseSchema } from '@/lib/schemas/expense'
import { insertExpense, fetchExpensesByUser } from '@/lib/services/expenseService'

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession()
    const expenses = await fetchExpensesByUser(session.user.id)
    return NextResponse.json(expenses)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession()
    const body = await req.json()
    const payload = CreateExpenseSchema.parse(body)
    const expense = await insertExpense({ ...payload, notes: payload.notes ?? null, user_id: session.user.id })
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
