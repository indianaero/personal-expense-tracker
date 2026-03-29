/**
 * Tests for lib/auth/config.ts — authOptions
 *
 * Covers:
 *  - callbacks.jwt     — persists user.id into token.sub on initial sign-in
 *  - callbacks.session — maps token.sub to session.user.id
 *  - CredentialsProvider.authorize — valid credentials, wrong password,
 *    missing credentials, unknown user, non-credentials provider, missing hash
 *
 * Mocking strategy:
 *  - '@/lib/supabaseClient' is replaced with a vi.hoisted() vi.fn() chain that
 *    simulates the Supabase fluent API (.from().select().eq().single()).
 *    vi.hoisted() is required because vi.mock() factory functions are hoisted
 *    to the top of the file by Vitest before const declarations are evaluated;
 *    any variable referenced inside a factory must itself be hoisted.
 *  - 'bcryptjs' compare is mocked so no real hashing occurs.
 *  - 'server-only' is stubbed to allow Node/Vitest to load the module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import type { Session, User } from 'next-auth'

// ---------- Hoisted mock primitives ----------
// These are created via vi.hoisted() so they are available inside vi.mock()
// factory functions, which Vitest moves to the top of the file at compile time.

const { mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockSingle, mockEq, mockSelect, mockFrom }
})

// ---------- Module-level mocks ----------

vi.mock('server-only', () => ({}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: { from: mockFrom },
  supabase: {},
}))

// ---------- Import after mocks are registered ----------

import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth/config'

const mockedBcryptCompare = vi.mocked(bcrypt.compare)

// ---------- Type helpers ----------

type JwtCallback = NonNullable<typeof authOptions.callbacks>['jwt']
type SessionCallback = NonNullable<typeof authOptions.callbacks>['session']

// The authorize function lives at providers[0].options.authorize.
// next-auth's CredentialsProvider wraps the options, so we access the function
// via `any` casts using intermediate variables (OXC rejects `as` inside
// generic argument positions or subscript chains).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthorizeFn = (...args: any[]) => Promise<User | null>

// ---------- Shared fixtures ----------

function buildToken(overrides: Partial<JWT> = {}): JWT {
  return {
    sub: '',
    iat: 0,
    exp: 0,
    jti: 'test-jti',
    ...overrides,
  }
}

function buildSession(userId = 'session-user-id'): Session {
  return {
    user: {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      image: null,
    },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-db-id',
    name: 'Test User',
    email: 'test@example.com',
    image: null,
    ...overrides,
  }
}

function getAuthorize(): AuthorizeFn {
  const provider = authOptions.providers[0] as AnyProvider
  return provider.options.authorize as AuthorizeFn
}

// ---------- Tests ----------

describe('authOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore safe defaults after each test so tests are fully independent.
    mockSingle.mockResolvedValue({ data: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  // ─── jwt callback ────────────────────────────────────────────────────────────

  describe('callbacks.jwt', () => {
    const jwtCallback = authOptions.callbacks!.jwt as NonNullable<JwtCallback>

    it('persists user.id into token.sub when user is present on initial sign-in', async () => {
      // Arrange
      const token = buildToken({ sub: '' })
      const user = buildUser({ id: 'supabase-uuid-abc' })

      // Act
      const result = await jwtCallback({ token, user, account: null, trigger: 'signIn' })

      // Assert
      expect(result.sub).toBe('supabase-uuid-abc')
    })

    it('does not overwrite an existing token.sub when user is undefined (subsequent requests)', async () => {
      // Arrange — no user object means this is a subsequent JWT refresh
      const token = buildToken({ sub: 'existing-sub' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noUser = undefined as any

      // Act
      const result = await jwtCallback({ token, user: noUser, account: null, trigger: 'update' })

      // Assert
      expect(result.sub).toBe('existing-sub')
    })

    it('does not overwrite token.sub when user exists but has no id property', async () => {
      // Arrange
      const token = buildToken({ sub: 'keep-this-sub' })
      const userWithoutId = { name: 'No ID User', email: 'x@x.com' } as User

      // Act
      const result = await jwtCallback({ token, user: userWithoutId, account: null, trigger: 'signIn' })

      // Assert
      expect(result.sub).toBe('keep-this-sub')
    })

    it('returns the full token object unchanged when no user is provided', async () => {
      // Arrange
      const token = buildToken({ sub: 'original', jti: 'my-jti' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noUser = undefined as any

      // Act
      const result = await jwtCallback({ token, user: noUser, account: null, trigger: 'update' })

      // Assert
      expect(result).toEqual(token)
    })
  })

  // ─── session callback ─────────────────────────────────────────────────────────

  describe('callbacks.session', () => {
    const sessionCallback = authOptions.callbacks!.session as NonNullable<SessionCallback>

    it('maps token.sub to session.user.id when token.sub is present', async () => {
      // Arrange
      const session = buildSession('old-id')
      const token = buildToken({ sub: 'correct-supabase-id' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapterUser = {} as any

      // Act
      const result = await sessionCallback({ session, token, user: adapterUser, newSession: null, trigger: 'update' }) as Session

      // Assert
      expect(result.user.id).toBe('correct-supabase-id')
    })

    it('does not modify session.user.id when token.sub is an empty string', async () => {
      // Arrange — empty string is falsy; the guard should not copy it
      const session = buildSession('original-id')
      const token = buildToken({ sub: '' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapterUser = {} as any

      // Act
      const result = await sessionCallback({ session, token, user: adapterUser, newSession: null, trigger: 'update' }) as Session

      // Assert
      expect(result.user.id).toBe('original-id')
    })

    it('returns the full session object with all original fields intact', async () => {
      // Arrange
      const session = buildSession()
      const token = buildToken({ sub: 'new-id' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapterUser = {} as any

      // Act
      const result = await sessionCallback({ session, token, user: adapterUser, newSession: null, trigger: 'update' }) as Session

      // Assert — user.id is updated but other fields pass through unchanged
      expect(result.user.name).toBe('Test User')
      expect(result.user.email).toBe('test@example.com')
      expect(result.expires).toBe(session.expires)
    })
  })

  // ─── CredentialsProvider.authorize ────────────────────────────────────────────

  describe('CredentialsProvider.authorize', () => {
    const authorize = getAuthorize()

    describe('happy path — valid credentials', () => {
      it('returns a user object with id, email, and name when credentials are correct', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-001',
          email: 'alice@example.com',
          name: 'Alice',
          password_hash: '$2b$12$hashedpassword',
          provider: 'credentials',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })
        mockedBcryptCompare.mockResolvedValueOnce(true as never)

        // Act
        const result = await authorize(
          { email: 'alice@example.com', password: 'correct-password' },
          {} as Request,
        )

        // Assert
        expect(result).toEqual({
          id: 'db-uuid-001',
          email: 'alice@example.com',
          name: 'Alice',
        })
      })

      it('queries Supabase using the lowercase-trimmed email', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-002',
          email: 'bob@example.com',
          name: 'Bob',
          password_hash: '$2b$12$hash',
          provider: 'credentials',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })
        mockedBcryptCompare.mockResolvedValueOnce(true as never)

        // Act
        await authorize({ email: '  BOB@EXAMPLE.COM  ', password: 'pass' }, {} as Request)

        // Assert — the .eq() call must use the normalised email
        expect(mockEq).toHaveBeenCalledWith('email', 'bob@example.com')
      })
    })

    describe('error path — missing credentials', () => {
      it('returns null when credentials is undefined', async () => {
        // Arrange / Act
        const result = await authorize(undefined, {} as Request)

        // Assert
        expect(result).toBeNull()
      })

      it('returns null when email is an empty string', async () => {
        // Arrange / Act
        const result = await authorize({ email: '', password: 'pass' }, {} as Request)

        // Assert
        expect(result).toBeNull()
      })

      it('returns null when password is an empty string', async () => {
        // Arrange / Act
        const result = await authorize({ email: 'test@example.com', password: '' }, {} as Request)

        // Assert
        expect(result).toBeNull()
      })

      it('does not call Supabase when credentials are missing', async () => {
        // Arrange / Act
        await authorize(undefined, {} as Request)

        // Assert
        expect(mockFrom).not.toHaveBeenCalled()
      })
    })

    describe('error path — user not found in database', () => {
      it('returns null when Supabase returns no matching user', async () => {
        // Arrange
        mockSingle.mockResolvedValueOnce({ data: null })

        // Act
        const result = await authorize(
          { email: 'ghost@example.com', password: 'irrelevant' },
          {} as Request,
        )

        // Assert
        expect(result).toBeNull()
      })

      it('does not call bcrypt when no user is found', async () => {
        // Arrange
        mockSingle.mockResolvedValueOnce({ data: null })

        // Act
        await authorize({ email: 'ghost@example.com', password: 'irrelevant' }, {} as Request)

        // Assert
        expect(mockedBcryptCompare).not.toHaveBeenCalled()
      })
    })

    describe('error path — wrong provider', () => {
      it('returns null when the user record has provider set to google', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-003',
          email: 'carol@example.com',
          name: 'Carol',
          password_hash: '$2b$12$hash',
          provider: 'google',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })

        // Act
        const result = await authorize(
          { email: 'carol@example.com', password: 'any-password' },
          {} as Request,
        )

        // Assert
        expect(result).toBeNull()
      })

      it('does not call bcrypt when provider is not credentials', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-003b',
          email: 'carol2@example.com',
          name: 'Carol2',
          password_hash: '$2b$12$hash',
          provider: 'google',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })

        // Act
        await authorize({ email: 'carol2@example.com', password: 'any-password' }, {} as Request)

        // Assert
        expect(mockedBcryptCompare).not.toHaveBeenCalled()
      })
    })

    describe('error path — missing password hash', () => {
      it('returns null when password_hash is null even if provider is credentials', async () => {
        // Arrange — account created via OAuth, no local password set
        const dbUser = {
          id: 'db-uuid-004',
          email: 'dan@example.com',
          name: 'Dan',
          password_hash: null,
          provider: 'credentials',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })

        // Act
        const result = await authorize(
          { email: 'dan@example.com', password: 'any-password' },
          {} as Request,
        )

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('error path — wrong password', () => {
      it('returns null when bcrypt.compare resolves to false', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-005',
          email: 'eve@example.com',
          name: 'Eve',
          password_hash: '$2b$12$someHash',
          provider: 'credentials',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })
        mockedBcryptCompare.mockResolvedValueOnce(false as never)

        // Act
        const result = await authorize(
          { email: 'eve@example.com', password: 'wrong-password' },
          {} as Request,
        )

        // Assert
        expect(result).toBeNull()
      })

      it('calls bcrypt.compare with the submitted password and the stored hash', async () => {
        // Arrange
        const dbUser = {
          id: 'db-uuid-006',
          email: 'frank@example.com',
          name: 'Frank',
          password_hash: '$2b$12$correctHash',
          provider: 'credentials',
        }
        mockSingle.mockResolvedValueOnce({ data: dbUser })
        mockedBcryptCompare.mockResolvedValueOnce(false as never)

        // Act
        await authorize(
          { email: 'frank@example.com', password: 'submitted-password' },
          {} as Request,
        )

        // Assert
        expect(mockedBcryptCompare).toHaveBeenCalledWith(
          'submitted-password',
          '$2b$12$correctHash',
        )
      })
    })
  })

  // ─── Static configuration ──────────────────────────────────────────────────

  describe('static configuration', () => {
    it('uses the jwt session strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt')
    })

    it('redirects to /login on sign-in', () => {
      expect(authOptions.pages?.signIn).toBe('/login')
    })

    it('redirects to /login on error', () => {
      expect(authOptions.pages?.error).toBe('/login')
    })

    it('has exactly one provider configured', () => {
      expect(authOptions.providers).toHaveLength(1)
    })
  })
})
