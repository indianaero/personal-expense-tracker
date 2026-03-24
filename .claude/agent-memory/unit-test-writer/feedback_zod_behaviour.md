---
name: Zod v3 evaluation-order edge cases
description: Discovered schema behaviours in lib/schemas/user.ts that contradict naive expectations about trim() and email validation ordering
type: feedback
---

## Rule: Zod validates before it transforms

In Zod v3, **validation runs before transforms**. This means:

### `.string().email().toLowerCase().trim()`

- An email with leading/trailing whitespace like `'  user@example.com  '` **fails** the `.email()` validator even though `.trim()` appears after it.
- The email regex sees the spaces and rejects the value.
- Callers must trim input before passing it to the schema (or the form must trim the value before submitting).
- This affects both `LoginSchema` and `RegisterSchema` in this project.

### `.string().min(1).max(100).trim()`

- A whitespace-only string like `'   '` **passes** `.min(1)` (original length = 3) and is then trimmed to `''`.
- The result is `success: true` with `data.name === ''`.
- This is a potential data quality gap in `RegisterSchema.name` — a whitespace-only name is accepted and stored as an empty string.
- If a future code review addresses this, the schema should be changed to `.string().trim().min(1)` (swap the order) or use `.refine(s => s.trim().length > 0)`.

**Why this matters:** Tests that assume trim() runs first and then validation runs second will produce false failures. Document schema behaviour as-is and flag the data quality gap with a comment in the test.

**How to apply:** When writing tests for any Zod schema with both `.trim()` and validation constraints, verify the actual parse result empirically before writing the test assertion.
