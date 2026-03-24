import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionState } from '../types'

// ---------------------------------------------------------------------------
// Mock dependencies before any import of the module under test.
//
// registerAction is a 'use server' file. Vitest does not understand that
// directive — it simply treats the file as a regular module, which is what
// we want. The directive itself is a no-op outside the Next.js build.
//
// Dependencies mocked:
//   - @/lib/supabaseClient  — prevents real Supabase calls (and avoids
//     importing 'server-only' twice, which is also mocked globally)
//   - bcryptjs              — makes password hashing deterministic and instant
// ---------------------------------------------------------------------------

// Mutable state shared between mock implementations and assertions
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()

// Chainable Supabase query builder mock.
// Each method returns `this` (the same object) so that calls like
// supabaseAdmin.from('users').select('id').eq('email', x).single()
// chain correctly without intermediate reference loss.
const queryBuilder = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  insert: mockInsert,
}

// Make every builder method return the builder itself for chaining
mockSelect.mockReturnValue(queryBuilder)
mockEq.mockReturnValue(queryBuilder)
mockSingle.mockReturnValue(queryBuilder)
mockInsert.mockReturnValue(queryBuilder)

const mockFrom = vi.fn().mockReturnValue(queryBuilder)

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: { from: mockFrom },
}))

// bcrypt mock — hash always returns a fixed string; compare is controlled
// per-test via mockResolvedValue/mockResolvedValueOnce.
const mockHash = vi.fn()
const mockCompare = vi.fn()

vi.mock('bcryptjs', () => ({
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
  hash: mockHash,
  compare: mockCompare,
}))

// Import AFTER all mocks are registered
const { registerAction } = await import('../register')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RegisterSuccess = { email: string; password: string }

const IDLE_STATE: ActionState<RegisterSuccess> = { status: 'idle' }
const HASHED_PASSWORD = '$2b$12$hashedpassword'

/** Build a FormData object with all four registration fields. */
function makeFormData(overrides?: {
  name?: string | null
  email?: string | null
  password?: string | null
  confirmPassword?: string | null
}): FormData {
  const fd = new FormData()
  fd.set('name', overrides?.name ?? 'Alice')
  fd.set('email', overrides?.email ?? 'alice@example.com')
  fd.set('password', overrides?.password ?? 'password123')
  fd.set('confirmPassword', overrides?.confirmPassword ?? 'password123')
  return fd
}

/** Simulates Supabase returning no existing user (email not taken). */
function setupNoExistingUser(): void {
  mockSingle.mockResolvedValueOnce({ data: null, error: null })
}

/** Simulates Supabase returning an existing user (email already taken). */
function setupExistingUser(): void {
  mockSingle.mockResolvedValueOnce({
    data: { id: 'existing-uuid' },
    error: null,
  })
}

/** Simulates a successful Supabase insert. */
function setupSuccessfulInsert(): void {
  mockInsert.mockResolvedValueOnce({ error: null })
}

/** Simulates a Supabase insert failure. */
function setupFailedInsert(message = 'DB error'): void {
  mockInsert.mockResolvedValueOnce({ error: { message } })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Re-apply the chainable return values after clearAllMocks resets them
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    mockSingle.mockReturnValue(queryBuilder)
    mockInsert.mockReturnValue(queryBuilder)
    mockFrom.mockReturnValue(queryBuilder)

    // Default hash behaviour — returns a predictable hash
    mockHash.mockResolvedValue(HASHED_PASSWORD)
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns status success with email and password when all inputs are valid', async () => {
      setupNoExistingUser()
      setupSuccessfulInsert()

      const result = await registerAction(IDLE_STATE, makeFormData())

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data?.email).toBe('alice@example.com')
        expect(result.data?.password).toBe('password123')
      }
    })

    it('hashes the password with bcrypt (12 rounds) before inserting', async () => {
      setupNoExistingUser()
      setupSuccessfulInsert()

      await registerAction(IDLE_STATE, makeFormData())

      expect(mockHash).toHaveBeenCalledWith('password123', 12)
    })

    it('inserts the hashed password (not the plain-text one) into the database', async () => {
      setupNoExistingUser()
      setupSuccessfulInsert()

      await registerAction(IDLE_STATE, makeFormData())

      // The insert call should receive an object containing the hash, never
      // the plain-text password.
      const insertCallArg = mockInsert.mock.calls[0][0] as Record<
        string,
        unknown
      >
      expect(insertCallArg.password_hash).toBe(HASHED_PASSWORD)
      expect(Object.values(insertCallArg)).not.toContain('password123')
    })

    it('normalises the email to lowercase before querying and inserting', async () => {
      setupNoExistingUser()
      setupSuccessfulInsert()

      await registerAction(
        IDLE_STATE,
        makeFormData({ email: 'ALICE@EXAMPLE.COM' }),
      )

      // The eq() call on the uniqueness check should use the lowercased email
      expect(mockEq).toHaveBeenCalledWith('email', 'alice@example.com')
    })

    it('inserts name, email, provider=credentials, and currency=USD', async () => {
      setupNoExistingUser()
      setupSuccessfulInsert()

      await registerAction(IDLE_STATE, makeFormData({ name: 'Alice' }))

      const insertCallArg = mockInsert.mock.calls[0][0] as Record<
        string,
        unknown
      >
      expect(insertCallArg.name).toBe('Alice')
      expect(insertCallArg.email).toBe('alice@example.com')
      expect(insertCallArg.provider).toBe('credentials')
      expect(insertCallArg.currency).toBe('USD')
    })
  })

  // ── Validation failure ────────────────────────────────────────────────────

  describe('when form data fails schema validation', () => {
    it('returns status error with a top-level error message', async () => {
      const result = await registerAction(
        IDLE_STATE,
        makeFormData({ email: 'not-an-email' }),
      )

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.error).toBe('Please fix the errors below.')
      }
    })

    it('returns a fields map containing the invalid field', async () => {
      const result = await registerAction(
        IDLE_STATE,
        makeFormData({ email: 'not-an-email' }),
      )

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.fields?.email).toBeDefined()
        expect(result.fields?.email?.length).toBeGreaterThan(0)
      }
    })

    it('returns a field error when name is missing', async () => {
      const fd = new FormData()
      // Omit name intentionally
      fd.set('email', 'alice@example.com')
      fd.set('password', 'password123')
      fd.set('confirmPassword', 'password123')

      const result = await registerAction(IDLE_STATE, fd)

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.fields?.name).toBeDefined()
      }
    })

    it('returns a field error when password is too short', async () => {
      const result = await registerAction(
        IDLE_STATE,
        makeFormData({ password: 'short', confirmPassword: 'short' }),
      )

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.fields?.password).toBeDefined()
      }
    })

    it('returns a confirmPassword field error when passwords do not match', async () => {
      const result = await registerAction(
        IDLE_STATE,
        makeFormData({
          password: 'password123',
          confirmPassword: 'different456',
        }),
      )

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.fields?.confirmPassword).toBeDefined()
        expect(result.fields?.confirmPassword).toContain('Passwords do not match.')
      }
    })

    it('does not call Supabase or bcrypt when validation fails', async () => {
      await registerAction(
        IDLE_STATE,
        makeFormData({ email: 'invalid' }),
      )

      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockHash).not.toHaveBeenCalled()
    })
  })

  // ── Duplicate email ───────────────────────────────────────────────────────

  describe('when the email is already registered', () => {
    it('returns status error', async () => {
      setupExistingUser()

      const result = await registerAction(IDLE_STATE, makeFormData())

      expect(result.status).toBe('error')
    })

    it('returns a field-level error on the email key', async () => {
      setupExistingUser()

      const result = await registerAction(IDLE_STATE, makeFormData())

      if (result.status === 'error') {
        expect(result.fields?.email).toBeDefined()
        expect(result.fields?.email).toContain(
          'An account with this email already exists.',
        )
      }
    })

    it('does not hash the password or insert a new row', async () => {
      setupExistingUser()

      await registerAction(IDLE_STATE, makeFormData())

      expect(mockHash).not.toHaveBeenCalled()
      expect(mockInsert).not.toHaveBeenCalled()
    })
  })

  // ── Database insert failure ───────────────────────────────────────────────

  describe('when the database insert fails', () => {
    it('returns status error', async () => {
      setupNoExistingUser()
      setupFailedInsert('unique constraint violated')

      const result = await registerAction(IDLE_STATE, makeFormData())

      expect(result.status).toBe('error')
    })

    it('returns the safe generic error message (no DB detail leaked)', async () => {
      setupNoExistingUser()
      setupFailedInsert('unique constraint violated')

      const result = await registerAction(IDLE_STATE, makeFormData())

      if (result.status === 'error') {
        expect(result.error).toBe('Something went wrong. Please try again.')
        // The raw database message must not appear in the response
        expect(result.error).not.toContain('unique constraint')
      }
    })

    it('does not include a fields map on a generic server error', async () => {
      setupNoExistingUser()
      setupFailedInsert()

      const result = await registerAction(IDLE_STATE, makeFormData())

      if (result.status === 'error') {
        expect(result.fields).toBeUndefined()
      }
    })
  })
})
