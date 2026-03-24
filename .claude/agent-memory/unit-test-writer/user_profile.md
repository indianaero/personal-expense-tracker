---
name: Developer profile
description: Inferred profile of the developer from codebase quality and technology choices
type: user
---

The developer is building a personal expense tracker with a production-quality codebase (Supabase, NextAuth v4, Zod, bcrypt, TypeScript strict mode, detailed documentation in /docs). The code follows security best practices (RLS, JWT sessions, bcrypt with 12 rounds, server-only imports). The docs are detailed and opinionated, suggesting familiarity with modern full-stack patterns.

No prior test setup existed — the developer is adding testing incrementally. They requested Jest but Vitest was substituted (with rationale given) due to ESM compatibility. The codebase uses Next.js App Router, which means server-only modules are common and need special handling in tests.

**How to apply:** Assume intermediate-to-senior level. Explain non-obvious choices (like Vitest vs Jest, or Zod evaluation order) concisely but without over-explaining basics. Code examples should match the project's conventions exactly (TypeScript strict, no `any`, consistent naming).
