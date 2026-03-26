---
name: Testing framework setup
description: Vitest configuration choices and package versions installed for this project
type: project
---

Vitest v4 (vitest, @vitest/coverage-v8, vite-tsconfig-paths) was installed as the test framework.

**Why:** No framework was pre-configured. Vitest was chosen over Jest because it has native ESM/TypeScript support without Babel, integrates directly with the Vite/OXC transform pipeline that Next.js 16 / Vite 6 uses, and the coverage provider (v8) requires zero extra config.

Config file: `vitest.config.ts` at project root — uses `vite-tsconfig-paths` to resolve `@/*` path aliases, `environment: 'node'`, includes `__tests__/**/*.test.ts(x)`.

Scripts added to `package.json`:
- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`

**How to apply:** Any future test setup or CI pipeline work should reference these scripts. Coverage output is lcov + text, stored under default `coverage/` directory.
