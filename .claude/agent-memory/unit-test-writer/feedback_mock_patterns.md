---
name: Reusable mock patterns for auth dependencies
description: How to mock Supabase chainable query builder, bcryptjs, next-auth getServerSession, and NextResponse in this project
type: feedback
---

## Pattern: Supabase chainable query builder

Supabase uses a fluent/chainable API: `.from().select().eq().single()`. All methods return the same `queryBuilder` object. After `vi.clearAllMocks()` in `beforeEach`, the chainable return values must be explicitly re-applied.

```ts
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()

const queryBuilder = { select: mockSelect, eq: mockEq, single: mockSingle, insert: mockInsert }

mockSelect.mockReturnValue(queryBuilder)
mockEq.mockReturnValue(queryBuilder)
mockSingle.mockReturnValue(queryBuilder)   // sync return for chaining
mockInsert.mockReturnValue(queryBuilder)

const mockFrom = vi.fn().mockReturnValue(queryBuilder)

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: { from: mockFrom },
}))

// In beforeEach — MUST re-apply after clearAllMocks:
beforeEach(() => {
  vi.clearAllMocks()
  mockSelect.mockReturnValue(queryBuilder)
  mockEq.mockReturnValue(queryBuilder)
  mockSingle.mockReturnValue(queryBuilder)
  mockInsert.mockReturnValue(queryBuilder)
  mockFrom.mockReturnValue(queryBuilder)
})

// Terminal resolution (e.g. .single() resolves to a row):
mockSingle.mockResolvedValueOnce({ data: user, error: null })
```

**Why:** `clearAllMocks` clears all mock state including `mockReturnValue`. Re-applying in beforeEach is mandatory.

## Pattern: bcryptjs mock

bcryptjs is a CommonJS module. Mock both the `default` export and named exports:

```ts
const mockHash = vi.fn()
const mockCompare = vi.fn()

vi.mock('bcryptjs', () => ({
  default: { hash: mockHash, compare: mockCompare },
  hash: mockHash,
  compare: mockCompare,
}))
```

When `lib/auth/config.ts` does `import bcrypt from 'bcryptjs'`, it gets the `default` export object. So `bcrypt.hash` === `mockHash` and `bcrypt.compare` === `mockCompare`.

## Pattern: next-auth getServerSession

```ts
const mockGetServerSession = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth/config', () => ({
  authOptions: {},
}))
```

## Pattern: NextResponse (next/server)

`NextResponse` is a Next.js runtime API — unavailable in plain Node. Replace with a lightweight spy:

```ts
const mockJsonResponse = vi.fn(
  (body: unknown, init?: { status?: number }) => ({
    _body: body,
    _status: init?.status ?? 200,
  }),
)

vi.mock('next/server', () => ({
  NextResponse: { json: mockJsonResponse },
}))

// Then import the module under test AFTER the mock:
const { handleApiError } = await import('../api')
```

**How to apply:** Always use this pattern when testing any file that imports from `next/server`. The dynamic import after `vi.mock()` ensures the mock is in place before module evaluation.
