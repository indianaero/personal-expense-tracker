import { NextRequest, NextResponse } from 'next/server'
import { getMonthlySummary } from '@/lib/services/summaryService'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get('user_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!userId || !year || !month) {
    return NextResponse.json(
      { error: 'Query params user_id, year, and month are required' },
      { status: 400 }
    )
  }

  const yearNum = parseInt(year, 10)
  const monthNum = parseInt(month, 10)

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return NextResponse.json(
      { error: 'year must be a number and month must be 1–12' },
      { status: 400 }
    )
  }

  try {
    const summary = await getMonthlySummary(userId, yearNum, monthNum)

    if (!summary) {
      return NextResponse.json(
        { error: 'No expenses found for this period' },
        { status: 404 }
      )
    }

    return NextResponse.json(summary)
  } catch (err) {
    console.error('[GET /api/summary]', err)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
