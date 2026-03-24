# Data Mutation Specification

**Stack:** Next.js 16.2.1 Server Actions · React 19 · Zod v3 · Supabase · TypeScript

---

## 1. Core Rules

These apply to every mutation in the application — no exceptions.

1. **Server Actions are the only mutation mechanism.** No `fetch`, `axios`, or any client-side HTTP call is used to write data. No mutation-only API routes are created. If data changes, a Server Action handles it.

2. **`FormData` is never used as an action parameter type.** `FormData` is an untyped bag of strings. Every action accepts a typed Zod schema output as its input — never raw `FormData`. Values are extracted and coerced at the form level before the action is called.

3. **Every action authenticates first.** `requireSession()` is called before any validation or business logic. An action that touches user data without calling `requireSession()` is a security defect.

4. **`user_id` always comes from the session.** The session is the only trusted source of identity. A `user_id` value from the action's typed input is always ignored and overwritten with `session.user.id`.

5. **Server-side Zod validation is always authoritative.** Client-side validation is a UX convenience. The server re-validates every input with `safeParse` regardless of what the client already checked.

6. **Every action returns `ActionState<T>`.** Actions never throw to the client, never return raw data, and never return inconsistent shapes. The return type is always the `ActionState<T>` union defined in `lib/actions/types.ts`.

7. **`revalidatePath` runs on every successful mutation.** Stale server component data is always invalidated after a write. Every affected route is listed explicitly.

---

## 2. Why Server Actions — Not API Routes

| Concern | Server Action | Mutation API Route |
|---|---|---|
| Network round-trips | Zero — runs in the same request | One extra HTTP call |
| TypeScript safety | Call-site type-checked end-to-end | Manually typed fetch body |
| Auth enforcement | Enforced inside the function | Must be enforced in every handler |
| Cache invalidation | `revalidatePath()` called inline | Must be triggered separately |
| Error handling | Returned as `ActionState`, not thrown | HTTP status + JSON parsing |
| Colocation | Lives next to the component that owns it | Lives in `app/api/` |
| Attack surface | Not a public HTTP endpoint | Publicly reachable URL |

**API routes are for reads only** (`GET`). They serve data to this app's Server Components and to any future consumers (mobile, scripts, third-party integrations). Writes are always Server Actions — they are not publicly addressable endpoints, they cannot be hit by curl, and they are automatically CSRF-protected by Next.js.

---

## 3. File Structure

All Server Actions live in `lib/actions/`, one file per domain resource.

```
lib/
└── actions/
    ├── types.ts          # ActionState<T> — shared return type
    ├── expense.ts        # createExpense, updateExpense, deleteExpense
    ├── category.ts       # createCategory, updateCategory, deleteCategory
    └── user.ts           # updateProfile, updatePreferences, deleteAccount
```

### Naming conventions

| Pattern | Example |
|---|---|
| File name — kebab-case, plural noun | `expense.ts`, `category.ts` |
| Action name — verb + noun, camelCase | `createExpense`, `deleteCategory` |
| Export — named, never default | `export async function createExpense(...)` |
| Server directive — first line of every actions file | `'use server'` |

The `'use server'` directive goes at the **top of the file**, not on each function. This marks the entire module as server-only and prevents accidental client-side imports.

---

## 4. Typed Input Pattern

`FormData` is banned as an action parameter type. This section explains the correct boundary.

### Why `FormData` parameters are banned

```ts
// ✗ Generic FormData parameter — untyped at every call site
export async function createExpenseAction(
  _prev: ActionState<Expense>,
  formData: FormData,             // untyped — any string key, any value
): Promise<ActionState<Expense>> {
  const amount = Number(formData.get('amount'))  // cast manually, no safety
  const description = formData.get('description') as string
  // ...
}
```

Problems with this pattern:
- TypeScript cannot check that callers pass correct fields
- Every field access requires manual casting
- Typos in key names (`formData.get('ammount')`) are silent
- Impossible to tell the action's contract from its signature alone

### The correct pattern — typed Zod input

```ts
// ✓ Typed input — the action's contract is explicit and checkable
export async function createExpenseAction(
  _prev: ActionState<Expense>,
  input: CreateExpenseInput,      // inferred from CreateExpenseSchema
): Promise<ActionState<Expense>> {
  // input is fully typed — no casting required
}
```

`CreateExpenseInput` is `z.infer<typeof CreateExpenseSchema>` — the TypeScript type that Zod produces after successful validation. By the time an action receives this type, the shape has been verified.

### Where the boundary is

The boundary — where raw values become typed — is in the **client component's submit handler**, not inside the action.

```
Client form           →   Client submit handler   →   Server Action
collects raw values      validates with Zod           receives typed input
(strings, numbers)       dispatches typed object      re-validates server-side
```

The client validates for UX. The server re-validates for security. Both use the same Zod schema.

---

## 5. Action Anatomy

Every action follows this four-step structure without exception.

```ts
'use server'
import { revalidatePath }      from 'next/cache'
import { requireSession }      from '@/lib/auth/session'
import { CreateExpenseSchema } from '@/lib/schemas'
import { insertExpense }       from '@/lib/services/expenseService'
import { Errors }              from '@/lib/errors'
import type { ActionState }    from './types'
import type { Expense }        from '@/types/models'
import type { CreateExpenseInput } from '@/lib/schemas'

export async function createExpenseAction(
  _prev: ActionState<Expense>,
  input: CreateExpenseInput,
): Promise<ActionState<Expense>> {

  // ── Step 1: Authenticate ─────────────────────────────────────
  // Always first. If this throws, nothing else runs.
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  // ── Step 2: Re-validate ──────────────────────────────────────
  // The server always validates — client validation is a UX aid only.
  // safeParse is used (not parse) so validation failure is a return, not a throw.
  const result = CreateExpenseSchema.safeParse(input)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  // ── Step 3: Execute ───────────────────────────────────────────
  // user_id always sourced from session — never from input.
  try {
    const expense = await insertExpense({
      ...result.data,
      user_id: session.user.id,
    })

    // ── Step 4: Invalidate and return ────────────────────────────
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success', data: expense }

  } catch (err) {
    console.error('[createExpenseAction] Failed to insert:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
```

The four steps are always in this order. Steps 1 and 2 must both complete successfully before Step 3 runs.

---

## 6. `ActionState<T>` Return Type

All actions return this union type. It is defined once in `lib/actions/types.ts` and imported everywhere.

```ts
// lib/actions/types.ts
export type ActionState<T = undefined> =
  | { status: 'idle' }
  | { status: 'error';   error: string; fields?: Record<string, string[]> }
  | { status: 'success'; data?: T }
```

### Shape rules

| State | Required fields | When |
|---|---|---|
| `idle` | — | Initial state before any submission |
| `error` | `error: string` | Any failure — auth, validation, DB, network |
| `error` with `fields` | `error` + `fields` | Zod validation failure with per-field messages |
| `success` | `data?` | Mutation completed; `data` is the created/updated record |

### `fields` map format

```ts
// Structure of fields when validation fails
fields: {
  'amount':      ['Amount must be greater than 0'],
  'description': ['Description is required'],
  'date':        ['Date must be in YYYY-MM-DD format'],
}
```

Keys are dot-notation paths matching Zod's `issue.path.join('.')`. Values are arrays of messages — always take `[0]` when displaying to keep the UI to one message per field.

---

## 7. Zod at the Action Boundary

### `safeParse`, not `parse`

Actions always use `safeParse`. The `parse` method throws a `ZodError` on failure; inside an action, that error would propagate to the client as a generic "Something went wrong." `safeParse` returns a discriminated union that lets the action return structured field errors instead.

```ts
// ✗ parse — throws on failure, generic error reaches the client
const data = CreateExpenseSchema.parse(input)

// ✓ safeParse — failure is returned as structured ActionState
const result = CreateExpenseSchema.safeParse(input)
if (!result.success) {
  return { status: 'error', error: 'Please fix the errors below.', fields: ... }
}
// From here, result.data is fully typed
```

### Schema re-use

The same Zod schema is used in both the client component (for immediate feedback) and the action (for authoritative validation). Never write two schemas for the same input.

```ts
// lib/schemas/expense.ts — one schema, used in both places
export const CreateExpenseSchema = z.object({ ... })
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
```

### Coercion at the client boundary

The client component is responsible for coercing values before calling `safeParse`. Raw form input values are always strings — coerce them to the expected types before passing to the schema.

```ts
// In the client submit handler — coerce before parsing
const result = CreateExpenseSchema.safeParse({
  amount:       Number(amountValue),        // string → number
  description:  descriptionValue.trim(),
  category_id:  selectedCategoryId,
  date:         dateValue,                  // already a string
  is_recurring: recurringChecked,           // boolean from checkbox
  notes:        notesValue || null,
})
```

Do not coerce inside the schema with `z.coerce` for action inputs — coercion belongs at the call site where the raw type is known. `z.coerce` is reserved for query param schemas where the source is always a string.

---

## 8. Auth and Ownership

### `requireSession()` is always first

```ts
// ✓ requireSession is the first statement in the action body
export async function deleteExpenseAction(
  _prev: ActionState,
  input: { id: string },
): Promise<ActionState> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }
  // ... rest of action
}
```

An action that performs any DB operation before calling `requireSession()` is a security defect, regardless of how trivial the operation appears.

### `user_id` always comes from the session

```ts
// ✓ user_id sourced from session — input.user_id is ignored even if present
const expense = await insertExpense({
  ...result.data,
  user_id: session.user.id,    // ← always this
})

// ✗ Never trust a user_id from the action input
const expense = await insertExpense({
  ...result.data,
  user_id: input.user_id,      // ← trivially spoofable
})
```

### Ownership on reads-before-write

When updating or deleting, confirm ownership by scoping the query to both `id` and `user_id`. If the record does not exist or belongs to another user, the service returns `null` — the action treats both cases as not found.

```ts
// lib/services/expenseService.ts
export async function deleteExpense(
  expenseId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)    // ← ownership enforced at the query level

  if (error) throw error
}

// lib/actions/expense.ts
export async function deleteExpenseAction(
  _prev: ActionState,
  input: { id: string },
): Promise<ActionState> {
  let session
  try { session = await requireSession() } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  try {
    await deleteExpense(input.id, session.user.id)
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success' }
  } catch (err) {
    console.error('[deleteExpenseAction] Failed to delete:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
```

Do not distinguish "not found" from "belongs to another user" in the response — return the same error for both. Leaking the distinction is an information disclosure vulnerability.

---

## 9. Cache Invalidation

Every successful mutation must call `revalidatePath` for all routes that display the changed data. Call it before the `return { status: 'success' }` line.

### Invalidation map

| Mutation | Paths to revalidate |
|---|---|
| Create expense | `/expenses`, `/dashboard` |
| Update expense | `/expenses`, `/expenses/[id]`, `/dashboard` |
| Delete expense | `/expenses`, `/dashboard` |
| Create category | `/categories`, `/expenses` (category selector) |
| Update category | `/categories`, `/expenses` |
| Delete / archive category | `/categories`, `/expenses` |
| Update profile | `/settings/profile` |
| Update preferences | `/settings/preferences` |

### `revalidateTag` for shared data

Use `revalidateTag` for data that is fetched by multiple routes under a shared logical key. Tag the fetch call and invalidate the tag — all routes using that tag revalidate at once.

```ts
// lib/services/categoryService.ts
export const fetchCategoriesByUser = cache(async (userId: string) => {
  const { data } = await supabaseAdmin
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .order('name')
  return data ?? []
})
```

```ts
// lib/actions/category.ts
export async function createCategoryAction(
  _prev: ActionState<Category>,
  input: CreateCategoryInput,
): Promise<ActionState<Category>> {
  // ...
  revalidatePath('/categories')
  revalidatePath('/expenses')   // expense form uses categories
  return { status: 'success', data: category }
}
```

If `revalidatePath` is insufficient (e.g. the same data appears in many deeply nested routes), switch to tagged caching with `unstable_cache` + `revalidateTag` — but prefer `revalidatePath` for its simplicity unless the data is genuinely shared across many routes.

---

## 10. Client Integration

### `useActionState` with typed dispatch

`useActionState` is the standard hook for actions bound to a form. The key difference from the `FormData` pattern: the form's `onSubmit` handler validates with Zod and calls `dispatch` with the typed result — the form element does not use `action={dispatch}`.

```tsx
'use client'
import { useActionState }         from 'react'
import { Alert, Button, Input }   from '@heroui/react'
import { createExpenseAction }    from '@/lib/actions/expense'
import { CreateExpenseSchema }    from '@/lib/schemas'

const initialState = { status: 'idle' } as const

export function CreateExpenseForm({ categories }: { categories: Category[] }) {
  const [state, dispatch, isPending] = useActionState(
    createExpenseAction,
    initialState,
  )

  // Local state for controlled inputs
  const [amount,      setAmount]      = useState('')
  const [description, setDescription] = useState('')
  const [categoryId,  setCategoryId]  = useState('')
  const [date,        setDate]        = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  // Client-side field errors from Zod (for immediate feedback)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientErrors({})

    // 1. Client-side validation — for UX only
    const result = CreateExpenseSchema.safeParse({
      amount:       Number(amount),
      description,
      category_id:  categoryId,
      date,
      is_recurring: isRecurring,
    })

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!errors[key]) errors[key] = issue.message
      }
      setClientErrors(errors)
      return
    }

    // 2. Dispatch typed Zod output — not FormData
    dispatch(result.data)
  }

  // Field errors: server errors take precedence over client errors
  const fieldErrors = state.status === 'error' && state.fields
    ? Object.fromEntries(
        Object.entries(state.fields).map(([k, v]) => [k, v[0]])
      )
    : clientErrors

  const formError = state.status === 'error' && !state.fields
    ? state.error
    : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError && (
        <Alert color="danger" variant="flat" title={formError} />
      )}

      <Input
        label="Description"
        variant="bordered"
        labelPlacement="outside"
        isRequired
        value={description}
        onValueChange={setDescription}
        isInvalid={!!fieldErrors.description}
        errorMessage={fieldErrors.description}
      />

      <Input
        label="Amount"
        type="number"
        variant="bordered"
        labelPlacement="outside"
        isRequired
        value={amount}
        onValueChange={setAmount}
        isInvalid={!!fieldErrors.amount}
        errorMessage={fieldErrors.amount}
      />

      {/* ... other fields */}

      <Button type="submit" color="primary" fullWidth isLoading={isPending}>
        Save
      </Button>
    </form>
  )
}
```

### `useTransition` for non-form mutations

For mutations triggered outside a form — row delete buttons, toggle switches, archive actions — use `useTransition` directly. There is no `useActionState` needed when there is no form state to manage.

```tsx
'use client'
import { useTransition } from 'react'
import { Button }        from '@heroui/react'
import { addToast }      from '@heroui/toast'
import { deleteExpenseAction } from '@/lib/actions/expense'

export function DeleteButton({ expenseId }: { expenseId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseAction({ id: expenseId })

      if (result.status === 'error') {
        addToast({ title: result.error, color: 'danger', timeout: 6000 })
        return
      }

      addToast({ title: 'Expense deleted', color: 'danger', timeout: 3000 })
    })
  }

  return (
    <Button
      color="danger"
      variant="light"
      isLoading={isPending}
      onPress={handleDelete}
    >
      Delete
    </Button>
  )
}
```

Do not use `useActionState` for inline mutations like delete — it is for form-shaped interactions that have `idle / error / success` state. For simple fire-and-forget mutations, `useTransition` is the correct tool.

### Success handling

After a successful action, the component decides what to do based on context:

| Mutation type | Success behaviour |
|---|---|
| Create (modal form) | Close modal, show success toast |
| Update (inline form) | Show success toast, field values reflect new data |
| Delete (confirmation modal) | Close modal, show toast — `revalidatePath` handles the list |
| Settings update | Show success toast in-place |

Success toasts use `addToast` from `@heroui/toast`:

```ts
import { addToast } from '@heroui/toast'

// In the client component after dispatch resolves to success
if (result.status === 'success') {
  addToast({ title: 'Expense saved', color: 'success', timeout: 3000 })
  onClose?.()
}
```

---

## 11. Optimistic Updates

Use `useOptimistic` when the mutation is very likely to succeed and the user should see the result immediately without waiting for the server round-trip. Typical candidates: deleting a row, toggling a boolean, archiving a category.

```tsx
'use client'
import { useOptimistic, useTransition } from 'react'
import { deleteExpenseAction }          from '@/lib/actions/expense'
import type { Expense }                 from '@/types/models'

export function ExpenseList({ initialExpenses }: { initialExpenses: Expense[] }) {
  const [isPending, startTransition] = useTransition()

  const [expenses, optimisticDelete] = useOptimistic(
    initialExpenses,
    (current: Expense[], deletedId: string) =>
      current.filter(e => e.id !== deletedId),
  )

  function handleDelete(expenseId: string) {
    startTransition(async () => {
      // UI updates immediately
      optimisticDelete(expenseId)

      const result = await deleteExpenseAction({ id: expenseId })

      if (result.status === 'error') {
        // React automatically reverts the optimistic update when the transition ends
        // The revert happens because revalidatePath re-fetches the real server data
        addToast({ title: result.error, color: 'danger', timeout: 6000 })
      }
    })
  }

  return (
    <ul>
      {expenses.map(e => (
        <li key={e.id}>
          {e.description}
          <button onClick={() => handleDelete(e.id)} disabled={isPending}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

**When not to use `useOptimistic`:**
- Create operations where the server generates the ID — the optimistic item would have a placeholder ID
- Operations that are likely to fail (e.g. uniqueness constraints, complex validations)
- Mutations where the server response contains fields the UI needs (computed fields, server-set timestamps)

---

## 12. Multi-step Mutations

When a mutation requires multiple DB operations, all steps run inside the action. If any step fails, return an error — do not leave the database in a partial state.

### Dependent operations

```ts
// lib/actions/expense.ts
export async function createExpenseAndUpdateSummaryAction(
  _prev: ActionState<Expense>,
  input: CreateExpenseInput,
): Promise<ActionState<Expense>> {
  let session
  try { session = await requireSession() } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  const result = CreateExpenseSchema.safeParse(input)
  if (!result.success) {
    // ... extract fields
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  try {
    // Step 1 — insert the expense
    const expense = await insertExpense({
      ...result.data,
      user_id: session.user.id,
    })

    // Step 2 — update the monthly summary (best-effort, non-critical)
    // Wrap in its own try/catch if failure should not block the primary operation
    try {
      await upsertMonthlySummary(session.user.id, result.data.date)
    } catch (summaryErr) {
      // Log but do not surface — the expense was saved, the summary can be recomputed
      console.error('[createExpenseAction] Failed to update summary:', summaryErr)
    }

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success', data: expense }

  } catch (err) {
    console.error('[createExpenseAction] Failed to insert:', err)
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
```

### Handling partial failure

Decide upfront whether each step in a multi-step mutation is **critical** (failure should abort the whole operation) or **non-critical** (failure should be logged but not surface to the user). Wrap non-critical steps in their own `try/catch`.

Do not implement your own transaction logic in application code — if atomicity is required, push the operation into a Supabase database function (RPC) and call it from the service layer:

```ts
// lib/services/expenseService.ts
export async function createExpenseAtomic(
  payload: InsertExpense
): Promise<Expense> {
  const { data, error } = await supabaseAdmin
    .rpc('create_expense_and_update_summary', payload)

  if (error) throw error
  return data
}
```

---

## 13. Anti-patterns — Never Do These

```ts
// ✗ FormData as the action parameter type
export async function createExpense(
  _prev: ActionState,
  formData: FormData,      // untyped — banned
) { ... }

// ✗ Client-side mutation via fetch
// In a 'use client' component:
const res = await fetch('/api/expenses', {
  method: 'POST',
  body: JSON.stringify({ amount, description }),
})

// ✗ Mutation API route when a Server Action would do
// app/api/expenses/route.ts — a POST handler for create
export async function POST(req: NextRequest) {
  const body = await req.json()
  await insertExpense({ ...body, user_id: session.user.id })
}

// ✗ user_id from input
export async function createExpenseAction(
  _prev: ActionState,
  input: CreateExpenseInput & { user_id: string }, // spoofable
) {
  await insertExpense({ ...input })   // uses client-supplied user_id
}

// ✗ Calling requireSession after any business logic
export async function deleteExpenseAction(_prev, input) {
  await deleteExpense(input.id)     // runs before auth check
  const session = await requireSession()   // too late
}

// ✗ parse instead of safeParse — throws a generic error to the client
const data = CreateExpenseSchema.parse(input)

// ✗ Missing revalidatePath after a successful mutation
export async function deleteExpenseAction(...) {
  await deleteExpense(input.id, session.user.id)
  return { status: 'success' }   // stale data shown to user until hard refresh
}

// ✗ Swallowing errors silently
try {
  await insertExpense(payload)
} catch {
  // nothing — the action returns success even though the insert failed
  return { status: 'success' }
}

// ✗ Leaking error detail to the client
} catch (err) {
  return { status: 'error', error: err.message }  // may contain DB schema details
}

// ✗ useActionState for a delete button — use useTransition instead
const [state, dispatch] = useActionState(deleteExpenseAction, initialState)
// delete is not a form interaction — it has no field state to manage

// ✗ Coercing inside the Zod schema for action inputs
const CreateExpenseSchema = z.object({
  amount: z.coerce.number(),   // z.coerce is for query params, not action inputs
})
// Coercion belongs in the submit handler before safeParse is called
```

---

## 14. Mutation Checklist

Run through this before shipping any feature that writes data.

**Action file**
- [ ] File starts with `'use server'` as the first line
- [ ] `requireSession()` is the first statement in the action body
- [ ] The second parameter is a Zod schema output type — not `FormData`
- [ ] `safeParse` is used — not `parse`
- [ ] `user_id` is sourced from `session.user.id` — never from `input`
- [ ] Ownership is enforced in service calls (`.eq('user_id', session.user.id)`)
- [ ] Every `catch` logs with context and returns `{ status: 'error', error: '...' }` — no throw
- [ ] `revalidatePath` is called for every affected route on success
- [ ] Return type is `Promise<ActionState<T>>`

**Schemas**
- [ ] A Zod schema in `lib/schemas/` covers all input fields
- [ ] Every constraint has a user-friendly `message`
- [ ] The schema's inferred type is used as the action's second parameter type
- [ ] No `z.coerce` in action schemas — coercion happens in the submit handler

**Client component**
- [ ] Form uses `onSubmit` — not `action={dispatch}` (which would pass FormData)
- [ ] `safeParse` runs before `dispatch` — client errors shown immediately without a server round-trip
- [ ] `dispatch` is called with `result.data` — the typed Zod output
- [ ] `isLoading={isPending}` on the submit button
- [ ] Field errors from `state.fields` displayed via HeroUI `Input errorMessage`
- [ ] Form-level `Alert color="danger"` rendered when `state.status === 'error'` and no `fields`
- [ ] Success toast via `addToast` — not a redirect (unless the UX requires navigation)
- [ ] Non-form mutations (delete, toggle) use `useTransition` — not `useActionState`

**Auth**
- [ ] All points in the `docs/auth.md` checklist pass for this mutation
