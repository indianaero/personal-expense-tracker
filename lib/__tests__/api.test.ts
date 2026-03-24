import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError, ZodIssueCode } from 'zod'
import { AppError } from '../errors'

// ---------------------------------------------------------------------------
// Mock next/server before importing the module under test.
//
// NextResponse is a Next.js runtime API unavailable in plain Node. We replace
// it with a lightweight stand-in that records the body and status code so our
// assertions can inspect them without needing the full Next.js runtime.
// ---------------------------------------------------------------------------

const mockJsonResponse = vi.fn(
  (body: unknown, init?: { status?: number }) => ({
    _body: body,
    _status: init?.status ?? 200,
  }),
)

vi.mock('next/server', () => ({
  NextResponse: {
    json: mockJsonResponse,
  },
}))

// Import AFTER the mock is registered so the module sees the stub.
const { handleApiError } = await import('../api')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ZodError from a list of raw issue descriptors. */
function makeZodError(
  issues: Array<{ path: string[]; message: string }>,
): ZodError {
  return new ZodError(
    issues.map(({ path, message }) => ({
      code: ZodIssueCode.custom,
      path,
      message,
    })),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleApiError', () => {
  beforeEach(() => {
    mockJsonResponse.mockClear()
  })

  // ── ZodError branch ──────────────────────────────────────────────────────

  describe('when called with a ZodError', () => {
    it('returns a 400 status', () => {
      const err = makeZodError([{ path: ['email'], message: 'Invalid email.' }])
      const response = handleApiError(err) as { _status: number }
      expect(response._status).toBe(400)
    })

    it('sets the top-level error message to the user-friendly string', () => {
      const err = makeZodError([{ path: ['email'], message: 'Invalid email.' }])
      const response = handleApiError(err) as { _body: Record<string, unknown> }
      expect(response._body.error).toBe('Please fix the errors below.')
    })

    it('sets code to VALIDATION_ERROR', () => {
      const err = makeZodError([
        { path: ['description'], message: 'Description is required.' },
      ])
      const response = handleApiError(err) as { _body: Record<string, unknown> }
      expect(response._body.code).toBe('VALIDATION_ERROR')
    })

    it('groups issues by field path into the fields map', () => {
      const err = makeZodError([
        { path: ['email'], message: 'Invalid email.' },
        { path: ['password'], message: 'Password is required.' },
      ])
      const response = handleApiError(err) as {
        _body: { fields: Record<string, string[]> }
      }
      expect(response._body.fields.email).toEqual(['Invalid email.'])
      expect(response._body.fields.password).toEqual(['Password is required.'])
    })

    it('accumulates multiple messages for the same field', () => {
      const err = makeZodError([
        { path: ['password'], message: 'Password is required.' },
        { path: ['password'], message: 'Password must be at least 8 characters.' },
      ])
      const response = handleApiError(err) as {
        _body: { fields: Record<string, string[]> }
      }
      expect(response._body.fields.password).toHaveLength(2)
      expect(response._body.fields.password).toContain('Password is required.')
      expect(response._body.fields.password).toContain(
        'Password must be at least 8 characters.',
      )
    })

    it('joins nested path segments with a dot', () => {
      // e.g. a Zod issue at path ['user', 'email'] → key 'user.email'
      const err = makeZodError([
        { path: ['user', 'email'], message: 'Invalid email.' },
      ])
      const response = handleApiError(err) as {
        _body: { fields: Record<string, string[]> }
      }
      expect(response._body.fields['user.email']).toEqual(['Invalid email.'])
    })
  })

  // ── AppError branch ──────────────────────────────────────────────────────

  describe('when called with an AppError', () => {
    it('uses the AppError statusCode as the HTTP status', () => {
      const err = new AppError('Resource not found.', 404, 'NOT_FOUND')
      const response = handleApiError(err) as { _status: number }
      expect(response._status).toBe(404)
    })

    it('uses the AppError message as the response error string', () => {
      const err = new AppError('Resource not found.', 404, 'NOT_FOUND')
      const response = handleApiError(err) as { _body: Record<string, unknown> }
      expect(response._body.error).toBe('Resource not found.')
    })

    it('forwards the AppError code into the response body', () => {
      const err = new AppError('Forbidden.', 403, 'FORBIDDEN')
      const response = handleApiError(err) as { _body: Record<string, unknown> }
      expect(response._body.code).toBe('FORBIDDEN')
    })

    it('handles a 401 unauthenticated error correctly', () => {
      const err = new AppError(
        'You must be signed in to do this.',
        401,
        'UNAUTHENTICATED',
      )
      const response = handleApiError(err) as {
        _status: number
        _body: Record<string, unknown>
      }
      expect(response._status).toBe(401)
      expect(response._body.code).toBe('UNAUTHENTICATED')
    })

    it('handles a 409 conflict error correctly', () => {
      const err = new AppError(
        'A category with that name already exists.',
        409,
        'CATEGORY_NAME_TAKEN',
      )
      const response = handleApiError(err) as {
        _status: number
        _body: Record<string, unknown>
      }
      expect(response._status).toBe(409)
      expect(response._body.code).toBe('CATEGORY_NAME_TAKEN')
    })
  })

  // ── Unknown error branch ─────────────────────────────────────────────────

  describe('when called with an unknown error', () => {
    it('returns a 500 status', () => {
      const response = handleApiError(new Error('boom')) as { _status: number }
      expect(response._status).toBe(500)
    })

    it('returns the safe generic error message', () => {
      const response = handleApiError(new Error('boom')) as {
        _body: Record<string, unknown>
      }
      expect(response._body.error).toBe(
        'Something went wrong. Please try again.',
      )
    })

    it('sets code to INTERNAL_ERROR', () => {
      const response = handleApiError(new Error('boom')) as {
        _body: Record<string, unknown>
      }
      expect(response._body.code).toBe('INTERNAL_ERROR')
    })

    it('does not leak the raw error message in the response body', () => {
      // The internal error message "boom" must never appear in the response
      const response = handleApiError(new Error('boom')) as {
        _body: Record<string, unknown>
      }
      expect(JSON.stringify(response._body)).not.toContain('boom')
    })

    it('handles a thrown string gracefully', () => {
      const response = handleApiError('string error') as { _status: number }
      expect(response._status).toBe(500)
    })

    it('handles a thrown null gracefully', () => {
      const response = handleApiError(null) as { _status: number }
      expect(response._status).toBe(500)
    })

    it('handles a thrown plain object gracefully', () => {
      const response = handleApiError({ unexpected: true }) as {
        _status: number
      }
      expect(response._status).toBe(500)
    })
  })
})
