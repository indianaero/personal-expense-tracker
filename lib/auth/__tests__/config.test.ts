import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextAuthOptions } from 'next-auth'

// ---------------------------------------------------------------------------
// Mock dependencies before any import of the module under test.
//
// lib/auth/config.ts imports:
//   - 'server-only'        → mocked globally in vitest.setup.ts
//   - '@/lib/supabaseClient' → mocked here to prevent real DB calls
//   - 'bcryptjs'           → mocked here to control comparison outcomes
// ---------------------------------------------------------------------------

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

const queryBuilder = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
}

mockSelect.mockReturnValue(queryBuilder)
mockEq.mockReturnValue(queryBuilder)
mockSingle.mockReturnValue(queryBuilder)

const mockFrom = vi.fn().mockReturnValue(queryBuilder)

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: { from: mockFrom },
}))

const mockCompare = vi.fn()
const mockHash = vi.fn()

vi.mock('bcryptjs', () => ({
  default: { compare: mockCompare, hash: mockHash },
  compare: mockCompare,
  hash: mockHash,
}))

// Import AFTER mocks are in place
const { authOptions } = await import('../config')

// ---------------------------------------------------------------------------
// Extract the authorize callback from the config.
//
// authOptions.providers is typed as Provider[], and CredentialsProvider
// produces an object with an `authorize` method. We extract it here to call
// it directly without needing the full NextAuth runtime.
// ---------------------------------------------------------------------------

type AuthorizeFunction = (
  credentials: Record<'email' | 'password', string> | undefined,
) => Promise<{ id: string; email: string; name: string } | null>

const credentialsProvider = (
  authOptions as NextAuthOptions
).providers[0] as unknown as {
  options: { authorize: AuthorizeFunction }
}

const authorize: AuthorizeFunction =
  credentialsProvider.options?.authorize ??
  // Fallback for providers that embed authorize directly
  (credentialsProvider as unknown as { authorize: AuthorizeFunction }).authorize

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CREDENTIALS = {
  email: 'user@example.com',
  password: 'password123',
}

const STORED_USER = {
  id: 'user-uuid-123',
  email: 'user@example.com',
  name: 'Alice',
  password_hash: '$2b$12$hashedpassword',
  provider: 'credentials',
}

/** Simulate Supabase returning a user row. */
function setupUserFound(user: typeof STORED_USER = STORED_USER): void {
  mockSingle.mockResolvedValueOnce({ data: user, error: null })
}

/** Simulate Supabase returning no user (null). */
function setupUserNotFound(): void {
  mockSingle.mockResolvedValueOnce({ data: null, error: null })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authOptions — credentials authorize callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore chainable return values cleared by clearAllMocks
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockSingle.mockReturnValue(queryBuilder)
    mockFrom.mockReturnValue(queryBuilder)
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('when credentials are valid', () => {
    it('returns the user object with id, email, and name', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(true)

      const result = await authorize(VALID_CREDENTIALS)

      expect(result).not.toBeNull()
      expect(result?.id).toBe('user-uuid-123')
      expect(result?.email).toBe('user@example.com')
      expect(result?.name).toBe('Alice')
    })

    it('compares the submitted password against the stored hash', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(true)

      await authorize(VALID_CREDENTIALS)

      expect(mockCompare).toHaveBeenCalledWith(
        'password123',
        STORED_USER.password_hash,
      )
    })

    it('queries Supabase with the lowercased, trimmed email', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(true)

      await authorize({ email: '  USER@EXAMPLE.COM  ', password: 'password123' })

      expect(mockEq).toHaveBeenCalledWith(
        'email',
        'user@example.com',
      )
    })

    it('does not include the password_hash in the returned object', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(true)

      const result = await authorize(VALID_CREDENTIALS)

      expect(result).not.toBeNull()
      // The returned shape must only contain id, email, name
      expect(Object.keys(result ?? {})).not.toContain('password_hash')
    })
  })

  // ── Missing credentials ───────────────────────────────────────────────────

  describe('when credentials are missing or incomplete', () => {
    it('returns null when credentials is undefined', async () => {
      const result = await authorize(undefined)
      expect(result).toBeNull()
    })

    it('returns null when email is an empty string', async () => {
      const result = await authorize({ email: '', password: 'password123' })
      expect(result).toBeNull()
    })

    it('returns null when password is an empty string', async () => {
      const result = await authorize({
        email: 'user@example.com',
        password: '',
      })
      expect(result).toBeNull()
    })

    it('does not call Supabase when credentials are missing', async () => {
      await authorize(undefined)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  // ── User not found ────────────────────────────────────────────────────────

  describe('when the user does not exist in the database', () => {
    it('returns null', async () => {
      setupUserNotFound()

      const result = await authorize(VALID_CREDENTIALS)

      expect(result).toBeNull()
    })

    it('does not call bcrypt.compare when no user is found', async () => {
      setupUserNotFound()

      await authorize(VALID_CREDENTIALS)

      expect(mockCompare).not.toHaveBeenCalled()
    })
  })

  // ── Wrong provider ────────────────────────────────────────────────────────

  describe('when the user was registered via a different provider', () => {
    it('returns null for a google-provider user', async () => {
      setupUserFound({ ...STORED_USER, provider: 'google', password_hash: '' })
      // Do NOT queue a mockCompare value here — bcrypt.compare must never be
      // reached for a non-credentials provider. Queuing an unused value would
      // bleed into subsequent tests.

      const result = await authorize(VALID_CREDENTIALS)

      expect(result).toBeNull()
    })

    it('does not call bcrypt.compare for a non-credentials provider', async () => {
      setupUserFound({ ...STORED_USER, provider: 'google', password_hash: '' })

      await authorize(VALID_CREDENTIALS)

      expect(mockCompare).not.toHaveBeenCalled()
    })
  })

  // ── Missing password hash ─────────────────────────────────────────────────

  describe('when the user record has no stored password hash', () => {
    it('returns null', async () => {
      // A credentials user with a null hash is a corrupt record — reject it
      setupUserFound({ ...STORED_USER, password_hash: '' })

      const result = await authorize(VALID_CREDENTIALS)

      expect(result).toBeNull()
    })
  })

  // ── Wrong password ────────────────────────────────────────────────────────

  describe('when the submitted password does not match the stored hash', () => {
    it('returns null', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(false)

      const result = await authorize({
        email: 'user@example.com',
        password: 'wrongpassword',
      })

      expect(result).toBeNull()
    })

    it('still calls bcrypt.compare even when the password is wrong', async () => {
      setupUserFound()
      mockCompare.mockResolvedValueOnce(false)

      await authorize({ email: 'user@example.com', password: 'wrongpassword' })

      expect(mockCompare).toHaveBeenCalledOnce()
    })
  })
})

// ---------------------------------------------------------------------------
// authOptions — jwt and session callbacks
//
// These callbacks are pure functions: they receive a token/session object
// and return a modified copy. No mocking needed — we call them directly.
// ---------------------------------------------------------------------------

describe('authOptions — jwt callback', () => {
  // Extract the jwt callback from authOptions
  const jwtCallback = (authOptions as NextAuthOptions).callbacks?.jwt as (args: {
    token: Record<string, unknown>
    user?: { id?: string }
  }) => Promise<Record<string, unknown>>

  it('copies user.id into token.sub on initial sign-in', async () => {
    const token = { sub: undefined as string | undefined }
    const user = { id: 'new-user-uuid' }

    const result = await jwtCallback({ token, user })

    expect(result.sub).toBe('new-user-uuid')
  })

  it('returns the token unchanged when user is not present (subsequent requests)', async () => {
    const token = { sub: 'existing-uuid', email: 'user@example.com' }

    const result = await jwtCallback({ token })

    expect(result.sub).toBe('existing-uuid')
    expect(result.email).toBe('user@example.com')
  })

  it('returns the token unchanged when user has no id', async () => {
    const token = { sub: 'existing-uuid' }
    const user = {}

    const result = await jwtCallback({ token, user })

    expect(result.sub).toBe('existing-uuid')
  })
})

describe('authOptions — session callback', () => {
  type SessionCallbackArgs = {
    session: { user: { id?: string; email?: string } }
    token: Record<string, unknown>
  }

  const sessionCallback = (authOptions as NextAuthOptions).callbacks
    ?.session as (args: SessionCallbackArgs) => Promise<SessionCallbackArgs['session']>

  it('copies token.sub into session.user.id', async () => {
    const session = { user: { email: 'user@example.com' } }
    const token = { sub: 'user-uuid-123' }

    const result = await sessionCallback({ session, token })

    expect(result.user.id).toBe('user-uuid-123')
  })

  it('returns the session unchanged when token has no sub', async () => {
    const session = { user: { email: 'user@example.com', id: 'existing-id' } }
    const token = {}

    const result = await sessionCallback({ session, token })

    // id stays as-is — no overwrite with undefined
    expect(result.user.id).toBe('existing-id')
  })
})
