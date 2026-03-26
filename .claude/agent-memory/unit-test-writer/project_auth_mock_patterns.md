---
name: Auth module mock patterns
description: Reusable mock setups for next-auth, supabaseClient, bcryptjs, and server-only in unit tests
type: project
---

Standard mock pattern for any test file that imports from `lib/auth/*`:

**server-only** — always stub with an empty module factory:
`vi.mock('server-only', () => ({}))`

**next-auth getServerSession** — mock the entire module:
`vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))`
Then: `const mockedGetServerSession = vi.mocked(getServerSession)`

**bcryptjs** — mock the default export:
`vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))`
Then: `const mockedBcryptCompare = vi.mocked(bcrypt.compare)`

**@/lib/supabaseClient with Supabase fluent chain** — use vi.hoisted() because the mocks are referenced inside a vi.mock() factory:
```ts
const { mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockSingle, mockEq, mockSelect, mockFrom }
})
vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: { from: mockFrom },
  supabase: {},
}))
```
In `beforeEach`, restore chain defaults:
```ts
mockSingle.mockResolvedValue({ data: null })
mockEq.mockReturnValue({ single: mockSingle })
mockSelect.mockReturnValue({ eq: mockEq })
mockFrom.mockReturnValue({ select: mockSelect })
```

**@/lib/auth/config** (when testing session.ts in isolation):
`vi.mock('@/lib/auth/config', () => ({ authOptions: {} }))`

**Why:** lib/auth/config.ts and lib/auth/session.ts both start with `import 'server-only'`. Without stubbing that sentinel, Node throws immediately on import. supabaseClient uses env vars that don't exist in test environments.

**How to apply:** Copy these stubs verbatim into any new test file that touches the auth layer. Always vi.hoisted() for anything the vi.mock() factory closes over.
