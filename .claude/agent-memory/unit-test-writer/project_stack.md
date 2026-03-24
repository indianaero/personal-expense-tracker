---
name: Testing stack and configuration
description: Test framework choice, vitest config, file locations, and npm scripts for this project
type: project
---

**Framework:** Vitest v4 (not Jest) with `@vitest/coverage-v8`.

**Why Vitest over Jest:** The project uses `"module": "esnext"` and `"moduleResolution": "bundler"` in tsconfig.json. Jest requires heavy ESM transform configuration in this setup. Vitest handles ESM natively with zero transform friction.

**Why:** ESM/bundler moduleResolution made Jest impractical without significant babel/swc transform setup.
**How to apply:** Always use `vitest` and `vi.*` APIs. Never suggest Jest as an alternative for this project.

## Config file
`vitest.config.ts` at project root:
- environment: `node` (all auth logic is server-side)
- globals: `true` (describe/it/expect available without import)
- `clearMocks: true`, `restoreMocks: true`
- setupFiles: `['./vitest.setup.ts']`
- Path alias `@/*` → project root (mirrors tsconfig paths)

## Setup file
`vitest.setup.ts` at project root:
- Mocks `server-only` as a no-op (`vi.mock('server-only', () => ({}))`).
- Required because `lib/auth/config.ts`, `lib/auth/session.ts`, and `lib/supabaseClient.ts` all import `server-only`, which throws in plain Node.

## npm scripts added
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

## Test file locations
Adjacent to source, inside `__tests__/` subdirectories:
- `lib/schemas/__tests__/user.test.ts`
- `lib/__tests__/errors.test.ts`
- `lib/__tests__/api.test.ts`
- `lib/auth/__tests__/session.test.ts`
- `lib/auth/__tests__/config.test.ts`
- `lib/actions/__tests__/register.test.ts`
