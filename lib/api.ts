import { NextResponse } from 'next/server'
import { ZodError }     from 'zod'
import { AppError }     from './errors'

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return NextResponse.json(
      { error: 'Please fix the errors below.', code: 'VALIDATION_ERROR', fields },
      { status: 400 },
    )
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode },
    )
  }

  console.error('[API] Unhandled error:', err)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
