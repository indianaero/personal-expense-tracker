---
name: Middleware test strategy — withAuth HOF extraction
description: How to unit-test NextAuth withAuth middleware without an Edge runtime
type: project
---

`middleware.ts` uses `withAuth` from `next-auth/middleware`, which is a higher-order function (HOF) that wraps the inner middleware function. The HOF result cannot be invoked directly in a Vitest/Node environment without a full Edge runtime.

**Pattern used:** Mock `next-auth/middleware` so that `withAuth` captures its two arguments (the inner middleware function and the options object) into module-level variables. Then test the two pure parts in isolation:

1. `capturedOptions.callbacks.authorized` — the route-guard callback (returns boolean)
2. `capturedMiddlewareFn` — the inner function that redirects auth-page visitors to /dashboard

```ts
let capturedMiddlewareFn: Function | null = null
let capturedOptions: Record<string, unknown> | null = null

vi.mock('next-auth/middleware', () => ({
  withAuth: vi.fn((middlewareFn, options) => {
    capturedMiddlewareFn = middlewareFn
    capturedOptions = options
    return vi.fn()
  }),
}))
```

The synthetic request object passed to both callbacks:
```ts
function buildRequest(pathname: string, token: object | null = null) {
  const url = new URL(`http://localhost${pathname}`)
  return { nextUrl: url, url: url.toString(), nextauth: { token } }
}
```

**Also tested:** `config.matcher` export — verify the string is defined and contains the known exclusion prefixes (`_next/static`, `favicon.ico`).

**Why:** withAuth runs in the Edge runtime; Vitest runs in Node. Testing the wrapped HOF output directly would require mocking the entire Edge environment. Capturing callbacks avoids that dependency entirely while still covering all meaningful logic.

**How to apply:** Use this same capture pattern for any other middleware HOFs (e.g., a future rate-limiter wrapper). The callbacks are the unit under test; the HOF is just wiring.
