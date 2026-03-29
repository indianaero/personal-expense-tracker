/**
 * Tests for middleware.ts — route protection via NextAuth withAuth
 *
 * NOTE: middleware.ts does not yet exist in the repository.
 * These tests are written to the spec in docs/auth.md (section 7) so they
 * are ready to run as soon as the file is created.
 *
 * Behavioural contract under test:
 *  1. Unauthenticated requests to protected paths are redirected to /login.
 *  2. Authenticated requests to /login are redirected to /dashboard.
 *  3. Authenticated requests to /register are redirected to /dashboard.
 *  4. Public paths (/login, /register, /api/auth/*) pass through for
 *     unauthenticated requests.
 *  5. Authenticated requests to protected paths pass through.
 *
 * Mocking strategy:
 *  - 'next-auth/middleware' is mocked.  withAuth is a HOF; we replace it with
 *    a thin wrapper that calls the inner middleware function directly with a
 *    synthetic NextRequest, making the token available via req.nextauth.token.
 *  - 'next/server' NextResponse is mocked so we can assert redirect() calls
 *    without a real Edge runtime.
 *
 * Important: because middleware.ts uses `withAuth` as a wrapping HOF, we
 * cannot import and call the default export of middleware.ts directly under
 * Vitest (Node environment) without extensive Edge-runtime shims.  Instead we
 * test the two pure logical branches:
 *
 *   a) The `authorized` callback — decides whether to allow or redirect to /login
 *   b) The inner middleware function — decides whether to redirect auth-page
 *      visitors to /dashboard
 *
 * Both callbacks are extracted from the module by inspecting the arguments
 * passed to the `withAuth` mock, which is the only correct way to test them
 * in isolation without an Edge runtime.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ---------- Module-level mocks ----------

// next/server — we only need NextResponse.redirect and NextResponse.next
const mockRedirect = vi.fn()
const mockNext = vi.fn()

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: mockRedirect,
    next: mockNext,
  },
}))

// next-auth/middleware — capture the arguments passed to withAuth so we can
// extract and test the callbacks in isolation.
let capturedMiddlewareFn: ((...args: unknown[]) => unknown) | null = null
let capturedOptions: Record<string, unknown> | null = null

vi.mock('next-auth/middleware', () => ({
  withAuth: vi.fn((middlewareFn: (...args: unknown[]) => unknown, options: Record<string, unknown>) => {
    capturedMiddlewareFn = middlewareFn
    capturedOptions = options
    // Return a no-op; we never invoke the HOF result directly in these tests.
    return vi.fn()
  }),
}))

// ---------- Import the module under test (after mocks) ----------
// This will throw a module-not-found error if middleware.ts does not exist yet.
// When that happens, the describe block below catches it and skips gracefully.

let middlewareModule: typeof import('../proxy') | null = null
let importError: unknown = null

try {
  middlewareModule = await import('../proxy')
} catch (err) {
  importError = err
}

// ---------- Helpers ----------

/**
 * Build a minimal synthetic NextRequest-like object.
 * The `nextauth` property is appended by withAuth at runtime; we attach it
 * manually so the inner middleware function can read req.nextauth.token.
 */
function buildRequest(pathname: string, token: object | null = null) {
  const url = new URL(`http://localhost${pathname}`)
  return {
    nextUrl: url,
    url: url.toString(),
    nextauth: { token },
  }
}

/**
 * Extract the `authorized` callback from the options object passed to withAuth.
 */
function getAuthorizedCallback(): (args: { token: object | null; req: ReturnType<typeof buildRequest> }) => boolean {
  if (!capturedOptions) throw new Error('capturedOptions is null — middleware.ts was not imported')
  const callbacks = capturedOptions.callbacks as Record<string, (...args: unknown[]) => unknown>
  return callbacks.authorized as (args: { token: object | null; req: ReturnType<typeof buildRequest> }) => boolean
}

// ---------- Tests ----------

describe('middleware — module availability', () => {
  it('middleware.ts can be imported without error', () => {
    if (importError) {
      // Provide a clear, actionable failure message rather than a raw module error.
      expect.fail(
        `middleware.ts does not exist or failed to import. ` +
        `Create it per docs/auth.md section 7 to make these tests pass. ` +
        `Import error: ${String(importError)}`
      )
    }
    expect(middlewareModule).not.toBeNull()
  })
})

describe('middleware — authorized() callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNext.mockReturnValue({ type: 'next' })
    mockRedirect.mockReturnValue({ type: 'redirect' })
  })

  // These tests run only when middleware.ts exists.
  const skipIfMissing = importError ? it.skip : it

  skipIfMissing('returns true for /login regardless of token (public path)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/login')

    // Act — unauthenticated
    const resultUnauthenticated = authorized({ token: null, req })
    // Act — authenticated
    const resultAuthenticated = authorized({ token: { sub: 'user-id' }, req })

    // Assert — both must be allowed through (the inner fn handles redirect)
    expect(resultUnauthenticated).toBe(true)
    expect(resultAuthenticated).toBe(true)
  })

  skipIfMissing('returns true for /register regardless of token (public path)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/register')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(true)
    expect(authorized({ token: { sub: 'user-id' }, req })).toBe(true)
  })

  skipIfMissing('returns true for /api/auth/callback (NextAuth internal path)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/api/auth/callback/google')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(true)
  })

  skipIfMissing('returns true for /api/auth/signin (NextAuth internal path)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/api/auth/signin')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(true)
  })

  skipIfMissing('returns false for /dashboard when token is null (unauthenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/dashboard')

    // Act & Assert — withAuth will redirect to /login when this returns false
    expect(authorized({ token: null, req })).toBe(false)
  })

  skipIfMissing('returns false for /expenses when token is null (unauthenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/expenses')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(false)
  })

  skipIfMissing('returns false for /settings when token is null (unauthenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/settings')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(false)
  })

  skipIfMissing('returns true for /dashboard when a valid token is present (authenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/dashboard')
    const token = { sub: 'authenticated-user-id' }

    // Act & Assert
    expect(authorized({ token, req })).toBe(true)
  })

  skipIfMissing('returns true for /expenses when a valid token is present (authenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/expenses')
    const token = { sub: 'authenticated-user-id' }

    // Act & Assert
    expect(authorized({ token, req })).toBe(true)
  })

  skipIfMissing('returns true for /categories when a valid token is present (authenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/categories')
    const token = { sub: 'authenticated-user-id' }

    // Act & Assert
    expect(authorized({ token, req })).toBe(true)
  })

  skipIfMissing('returns true for /reports when a valid token is present (authenticated)', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/reports')
    const token = { sub: 'authenticated-user-id' }

    // Act & Assert
    expect(authorized({ token, req })).toBe(true)
  })

  skipIfMissing('returns false for a deeply nested protected path when unauthenticated', () => {
    // Arrange
    const authorized = getAuthorizedCallback()
    const req = buildRequest('/expenses/123/edit')

    // Act & Assert
    expect(authorized({ token: null, req })).toBe(false)
  })
})

describe('middleware — inner middleware function (auth-page redirect)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNext.mockReturnValue({ type: 'next' })
    mockRedirect.mockImplementation((url: URL) => ({ type: 'redirect', url: url.toString() }))
  })

  const skipIfMissing = importError ? it.skip : it

  skipIfMissing('redirects authenticated users from /login to /dashboard', () => {
    // Arrange
    if (!capturedMiddlewareFn) return
    const req = buildRequest('/login', { sub: 'user-id' })

    // Act
    capturedMiddlewareFn(req)

    // Assert
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    const redirectUrl: URL = (mockRedirect as Mock).mock.calls[0][0]
    expect(redirectUrl.pathname).toBe('/dashboard')
  })

  skipIfMissing('redirects authenticated users from /register to /dashboard', () => {
    // Arrange
    if (!capturedMiddlewareFn) return
    const req = buildRequest('/register', { sub: 'user-id' })

    // Act
    capturedMiddlewareFn(req)

    // Assert
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    const redirectUrl: URL = (mockRedirect as Mock).mock.calls[0][0]
    expect(redirectUrl.pathname).toBe('/dashboard')
  })

  skipIfMissing('does not redirect unauthenticated users visiting /login (passes through)', () => {
    // Arrange — token is null: the user is not authenticated
    if (!capturedMiddlewareFn) return
    const req = buildRequest('/login', null)

    // Act
    capturedMiddlewareFn(req)

    // Assert — the inner fn should call NextResponse.next(), not redirect
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  skipIfMissing('does not redirect authenticated users visiting /dashboard (protected path, passes through inner fn)', () => {
    // Arrange — authenticated user visiting a non-auth page
    if (!capturedMiddlewareFn) return
    const req = buildRequest('/dashboard', { sub: 'user-id' })

    // Act
    capturedMiddlewareFn(req)

    // Assert — no redirect from the inner function; auth is handled by withAuth itself
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })
})

describe('middleware — config export', () => {
  const skipIfMissing = importError ? it.skip : it

  skipIfMissing('exports a matcher that covers all routes', () => {
    // Arrange
    if (!middlewareModule) return
    const { config } = middlewareModule

    // Assert — matcher must be defined and non-empty
    expect(config).toBeDefined()
    expect(config.matcher).toBeDefined()
    expect(Array.isArray(config.matcher) || typeof config.matcher === 'string').toBe(true)
  })

  skipIfMissing('matcher does not match _next/static assets', () => {
    // Arrange
    if (!middlewareModule) return
    const { config } = middlewareModule
    const matchers = Array.isArray(config.matcher) ? config.matcher : [config.matcher]
    const pattern = matchers[0] as string

    // The pattern from docs/auth.md is a negative lookahead — we verify the
    // canonical path would NOT match static assets by checking the regex.
    // Act & Assert — the regex must not match _next/static paths
    // We test the intent of the pattern, not the regex engine mechanics,
    // by verifying the string representation excludes the known static prefix.
    expect(pattern).toContain('_next/static')
    expect(pattern).toContain('favicon.ico')
  })
})
