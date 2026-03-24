import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from 'next-auth'

// ---------------------------------------------------------------------------
// Mock dependencies before any import of the module under test.
//
// requireSession() calls getServerSession() from next-auth. We mock the
// entire module so no real network or NextAuth runtime is needed.
// The `server-only` mock is applied globally in vitest.setup.ts.
// ---------------------------------------------------------------------------

const mockGetServerSession = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

// @/lib/auth/config imports 'server-only' (handled by vitest.setup.ts) and
// supabaseClient. Neither is needed for session tests — mock it.
vi.mock('@/lib/auth/config', () => ({
  authOptions: {},
}))

// Import after mocks are set up
const { requireSession } = await import('../session')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSession(overrides?: Partial<Session['user']>): Session {
  return {
    user: {
      id: 'user-uuid-123',
      email: 'user@example.com',
      name: 'Alice',
      ...overrides,
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireSession', () => {
  beforeEach(() => {
    mockGetServerSession.mockReset()
  })

  describe('when a valid session exists', () => {
    it('returns the session object when session.user.id is present', async () => {
      const session = buildSession()
      mockGetServerSession.mockResolvedValue(session)

      const result = await requireSession()

      expect(result).toBe(session)
    })

    it('calls getServerSession with authOptions', async () => {
      mockGetServerSession.mockResolvedValue(buildSession())

      await requireSession()

      // Verify it passed exactly one argument (authOptions) — ensures it
      // doesn't call getServerSession() without options, which returns null
      // in NextAuth v4.
      expect(mockGetServerSession).toHaveBeenCalledOnce()
      expect(mockGetServerSession).toHaveBeenCalledWith(expect.anything())
    })

    it('exposes session.user.id without modification', async () => {
      const session = buildSession({ id: 'specific-uuid-456' })
      mockGetServerSession.mockResolvedValue(session)

      const result = await requireSession()

      expect(result.user.id).toBe('specific-uuid-456')
    })
  })

  describe('when no valid session exists', () => {
    it('throws when getServerSession returns null', async () => {
      mockGetServerSession.mockResolvedValue(null)

      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws when getServerSession returns undefined', async () => {
      mockGetServerSession.mockResolvedValue(undefined)

      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws when session exists but user.id is missing', async () => {
      const sessionWithoutId = {
        user: { email: 'user@example.com', name: 'Alice' },
        expires: new Date(Date.now() + 3600 * 1000).toISOString(),
      }
      mockGetServerSession.mockResolvedValue(sessionWithoutId)

      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws when session exists but user.id is an empty string', async () => {
      const sessionWithEmptyId = buildSession({ id: '' })
      mockGetServerSession.mockResolvedValue(sessionWithEmptyId)

      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws when session.user is null', async () => {
      mockGetServerSession.mockResolvedValue({
        user: null,
        expires: new Date(Date.now() + 3600 * 1000).toISOString(),
      })

      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws an Error (not an AppError) with message "UNAUTHENTICATED"', async () => {
      mockGetServerSession.mockResolvedValue(null)

      try {
        await requireSession()
        expect.fail('should have thrown')
      } catch (err) {
        // The implementation throws a plain Error — verify the type and message
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe('UNAUTHENTICATED')
      }
    })
  })

  describe('when getServerSession itself throws', () => {
    it('propagates the underlying error to the caller', async () => {
      mockGetServerSession.mockRejectedValue(new Error('DB connection failed'))

      await expect(requireSession()).rejects.toThrow('DB connection failed')
    })
  })
})
