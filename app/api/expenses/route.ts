import { NextRequest, NextResponse } from 'next/server'
import { insertExpense, fetchExpensesByUser } from '@/lib/services/expenseService'
import type { InsertExpense } from '@/types/models'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 })
  }

  try {
    const expenses = await fetchExpensesByUser(userId)
    return NextResponse.json(expenses)
  } catch (err) {
    console.error('[GET /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, category_id, amount, description, notes, date, is_recurring } = body

    if (!user_id || !category_id || amount === undefined || !description || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, category_id, amount, description, date' },
        { status: 400 }
      )
    }

    const payload: InsertExpense = {
      user_id,
      category_id,
      amount: Number(amount),
      description,
      notes: notes ?? null,
      date,
      is_recurring: is_recurring ?? false,
    }

    const expense = await insertExpense(payload)
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    console.error('[POST /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
