---
name: Vitest 4 OXC parser constraints
description: Two specific TypeScript patterns that the OXC transformer (used by Vitest 4 / Vite 6) rejects at parse time
type: feedback
---

Vitest 4 uses the OXC transformer instead of esbuild. OXC rejects two patterns that esbuild and tsc accept:

1. `as` type cast inside a subscript/generic-argument chain, e.g.:
   `(typeof foo as any)['bar']` inside `Parameters<...>` — OXC throws "Expected `)` but found `as`".
   Fix: extract the cast to an intermediate type alias or `const` variable before using it in the chain.

2. `vi.mock()` factory functions that close over module-level `const` declarations.
   Vitest hoists `vi.mock()` calls to the top of the file at compile time, but `const` declarations are not hoisted — so the factory sees a TDZ variable.
   Fix: declare all mock primitives using `vi.hoisted()` and destructure from its return value. Those variables are initialized before the hoisting happens.

**Why:** Both issues were hit during the auth test suite setup on 2026-03-25. They are silent correctness bugs if not caught early — the OXC error kills the entire test file.

**How to apply:** Any time a new test file uses `vi.mock()` with a factory that references module-level variables, use `vi.hoisted()`. Any `as any` cast inside a subscript chain or generic arg must be extracted to a variable first.
