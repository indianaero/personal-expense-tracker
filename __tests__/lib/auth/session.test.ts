/**
 * Tests for lib/auth/session.ts — requireSession()
 *
 * Strategy: mock getServerSession from 'next-auth' so that no real
 * NextAuth JWT verification or network activity takes place.
 * The 'server-only' sentinel import is stubbed at module level so
 * Node (running under Vitest) does not throw when the module is loaded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- Module-level mocks (hoisted before any import resolution) ----------

// 'server-only' is a runtime guard that throws in non-server environments.
// Stub it so Vitest can import the module under test without error.
vi.mock('server-only', () => ({}))

// Mock next-auth so we control what getServerSession returns.
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// authOptions is imported by session.ts; the actual config module in turn
// imports 'server-only' and '@/lib/supabaseClient', both of which must be
// stubbed so the import chain resolves cleanly.
vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: {},
  supabase: {},
}))

vi.mock('@/lib/auth/config', () => ({
  authOptions: {},
}))

// ---------- Import after mocks are registered ----------

import { getServerSession } from 'next-auth'
import { requireSession } from '@/lib/auth/session'
import type { Session } from 'next-auth'

// Typed alias so individual tests can set return values without casting.
const mockedGetServerSession = vi.mocked(getServerSession)

// ---------- Helpers ----------

function buildSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'user-uuid-123',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      ...overrides,
    },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }
}

// ---------- Tests ----------

describe('requireSession()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('happy path — valid session', () => {
    it('returns the session object when getServerSession resolves with a valid session', async () => {
      // Arrange
      const expected = buildSession()
      mockedGetServerSession.mockResolvedValueOnce(expected)

      // Act
      const result = await requireSession()

      // Assert
      expect(result).toBe(expected)
    })

    it('calls getServerSession exactly once per invocation', async () => {
      // Arrange
      mockedGetServerSession.mockResolvedValueOnce(buildSession())

      // Act
      await requireSession()

      // Assert
      expect(mockedGetServerSession).toHaveBeenCalledTimes(1)
    })

    it('returns a session whose user.id equals the value provided by getServerSession', async () => {
      // Arrange
      const session = buildSession({ id: 'specific-user-id' })
      mockedGetServerSession.mockResolvedValueOnce(session)

      // Act
      const result = await requireSession()

      // Assert
      expect(result.user.id).toBe('specific-user-id')
    })
  })

  describe('error path — null session', () => {
    it('throws an Error with message UNAUTHENTICATED when getServerSession returns null', async () => {
      // Arrange
      mockedGetServerSession.mockResolvedValueOnce(null)

      // Act & Assert
      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws an Error instance (not a plain string) when unauthenticated', async () => {
      // Arrange
      mockedGetServerSession.mockResolvedValueOnce(null)

      // Act & Assert
      await expect(requireSession()).rejects.toBeInstanceOf(Error)
    })
  })

  describe('error path — session missing user.id', () => {
    it('throws UNAUTHENTICATED when the session exists but user.id is an empty string', async () => {
      // Arrange — empty string is falsy, so the guard should fire
      const session = buildSession({ id: '' })
      mockedGetServerSession.mockResolvedValueOnce(session)

      // Act & Assert
      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws UNAUTHENTICATED when the session object has no user property at all', async () => {
      // Arrange — cast to bypass TS so we can simulate a malformed session
      const malformedSession = { expires: new Date().toISOString() } as unknown as Session
      mockedGetServerSession.mockResolvedValueOnce(malformedSession)

      // Act & Assert
      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })

    it('throws UNAUTHENTICATED when session.user is null', async () => {
      // Arrange
      const malformedSession = {
        user: null,
        expires: new Date().toISOString(),
      } as unknown as Session
      mockedGetServerSession.mockResolvedValueOnce(malformedSession)

      // Act & Assert
      await expect(requireSession()).rejects.toThrow('UNAUTHENTICATED')
    })
  })

  describe('error path — getServerSession itself throws', () => {
    it('propagates the underlying error when getServerSession rejects', async () => {
      // Arrange
      const networkError = new Error('Database connection refused')
      mockedGetServerSession.mockRejectedValueOnce(networkError)

      // Act & Assert
      await expect(requireSession()).rejects.toThrow('Database connection refused')
    })
  })
})
