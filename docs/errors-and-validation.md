# Errors & Validation Specification

**Stack:** Zod · Next.js 16.2.1 App Router · React 19 · HeroUI · TypeScript

---

## 1. Core Rules

These apply everywhere — no exceptions.

1. **Zod validates every external input.** Request bodies, query strings, form data, and search params are all validated with a Zod schema before any business logic runs. Ad-hoc `if (!field)` checks are not used for validation.

2. **No technical detail is ever sent to the client.** Stack traces, database errors, raw Supabase error objects, and internal identifiers never appear in API responses or UI messages. The server logs the real error; the client receives a safe, human-readable message.

3. **HeroUI is the only rendering surface for errors.** Field errors go on `Input` via `errorMessage`. Form-level errors use the HeroUI `Alert` component. Transient feedback (save success, delete confirmation) uses `addToast`. No custom error UI is built.

4. **Validation runs on both sides.** Client-side validation with Zod gives immediate feedback without a network round-trip. Server-side validation is always the authoritative check — client-side validation is a UX convenience, not a security control.

5. **Error messages are written for users, not engineers.** "Something went wrong, please try again" rather than "PostgreSQL error: duplicate key value violates unique constraint". Specific field messages ("Amount must be greater than 0") rather than generic ones ("Invalid input").

---

## 2. Error Classification

Every error produced by an API route belongs to one of these categories. Use the correct HTTP status code for each.

| Category | HTTP status | When to use | User-facing message pattern |
|---|---|---|---|
| **Validation** | `400` | Input fails Zod schema | Per-field: "Description is required" |
| **Unauthenticated** | `401` | No valid session | "You must be signed in to do this" |
| **Forbidden** | `403` | Session exists but wrong user | "You do not have permission to do this" |
| **Not Found** | `404` | Resource doesn't exist or belongs to another user | "This expense could not be found" |
| **Conflict** | `409` | Duplicate (e.g. category name already exists) | "A category with that name already exists" |
| **Server Error** | `500` | Unhandled exception, DB failure | "Something went wrong. Please try again." |

Never return a `500` for a bad request. Never return a `400` for an internal failure.

---

## 3. Standard API Error Shape

All API error responses use this shape, consistently, across every route.

```ts
// Successful responses return the resource directly — no wrapper
// Error responses always use this shape:
type ApiErrorResponse = {
  error: string                              // human-readable, safe to display
  code?: string                              // machine-readable, e.g. 'CATEGORY_NAME_TAKEN'
  fields?: Record<string, string[]>          // field-level messages from Zod, 400 only
}
```

### Examples

```json
// 400 — validation failure (includes fields)
{
  "error": "Please fix the errors below.",
  "code": "VALIDATION_ERROR",
  "fields": {
    "amount":      ["Amount must be greater than 0"],
    "description": ["Description is required"]
  }
}

// 401 — no session
{
  "error": "You must be signed in to do this.",
  "code": "UNAUTHENTICATED"
}

// 404 — resource not found or doesn't belong to user
{
  "error": "This expense could not be found.",
  "code": "NOT_FOUND"
}

// 409 — conflict
{
  "error": "A category with that name already exists.",
  "code": "CATEGORY_NAME_TAKEN"
}

// 500 — internal error (no technical detail)
{
  "error": "Something went wrong. Please try again.",
  "code": "INTERNAL_ERROR"
}
```

---

## 4. Zod Schema Library

All Zod schemas live in `lib/schemas/`. One file per resource. Never define validation inline in a route file or component.

### 4.1 File structure

```
lib/
└── schemas/
    ├── expense.ts      # CreateExpenseSchema, UpdateExpenseSchema
    ├── category.ts     # CreateCategorySchema, UpdateCategorySchema
    ├── user.ts         # LoginSchema, RegisterSchema, UpdateUserSchema
    └── index.ts        # re-exports all schemas
```

---

### 4.2 Expense schemas — `lib/schemas/expense.ts`

```ts
import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  category_id:  z.string().uuid({ message: 'Please select a valid category.' }),
  amount:       z
    .number({ invalid_type_error: 'Amount must be a number.' })
    .positive({ message: 'Amount must be greater than 0.' })
    .max(1_000_000, { message: 'Amount cannot exceed 1,000,000.' }),
  description:  z
    .string({ required_error: 'Description is required.' })
    .min(1,   { message: 'Description is required.' })
    .max(255, { message: 'Description cannot exceed 255 characters.' })
    .trim(),
  notes:        z
    .string()
    .max(1000, { message: 'Notes cannot exceed 1,000 characters.' })
    .trim()
    .nullable()
    .optional(),
  date:         z
    .string({ required_error: 'Date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' }),
  is_recurring: z.boolean().optional().default(false),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>
```

---

### 4.3 Category schemas — `lib/schemas/category.ts`

```ts
import { z } from 'zod'

export const CreateCategorySchema = z.object({
  name:       z
    .string({ required_error: 'Category name is required.' })
    .min(1,   { message: 'Category name is required.' })
    .max(50,  { message: 'Category name cannot exceed 50 characters.' })
    .trim(),
  is_default: z.boolean().optional().default(false),
})

export const UpdateCategorySchema = z.object({
  name:        z
    .string()
    .min(1,   { message: 'Category name is required.' })
    .max(50,  { message: 'Category name cannot exceed 50 characters.' })
    .trim()
    .optional(),
  is_archived: z.boolean().optional(),
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>
```

---

### 4.4 User schemas — `lib/schemas/user.ts`

```ts
import { z } from 'zod'

export const LoginSchema = z.object({
  email:    z
    .string({ required_error: 'Email is required.' })
    .email({ message: 'Please enter a valid email address.' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, { message: 'Password is required.' }),
})

export const RegisterSchema = z
  .object({
    name:            z
      .string({ required_error: 'Name is required.' })
      .min(1,   { message: 'Name is required.' })
      .max(100, { message: 'Name cannot exceed 100 characters.' })
      .trim(),
    email:           z
      .string({ required_error: 'Email is required.' })
      .email({ message: 'Please enter a valid email address.' })
      .toLowerCase()
      .trim(),
    password:        z
      .string({ required_error: 'Password is required.' })
      .min(8,  { message: 'Password must be at least 8 characters.' })
      .max(72, { message: 'Password cannot exceed 72 characters.' }),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password.' }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path:    ['confirmPassword'],
  })

export const UpdateUserSchema = z.object({
  name:     z
    .string()
    .min(1,   { message: 'Name is required.' })
    .max(100, { message: 'Name cannot exceed 100 characters.' })
    .trim()
    .optional(),
  currency: z
    .string()
    .length(3, { message: 'Currency must be a 3-letter code (e.g. USD).' })
    .toUpperCase()
    .optional(),
})

export type LoginInput    = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
```

---

### 4.5 Query param schemas

Query strings are always strings. Coerce them to the expected type using `z.coerce`.

```ts
// lib/schemas/query.ts
import { z } from 'zod'

export const SummaryQuerySchema = z.object({
  year:  z.coerce
    .number({ invalid_type_error: 'Year must be a number.' })
    .int()
    .min(2000, { message: 'Year must be 2000 or later.' })
    .max(2100, { message: 'Year must be 2100 or earlier.' }),
  month: z.coerce
    .number({ invalid_type_error: 'Month must be a number.' })
    .int()
    .min(1,  { message: 'Month must be between 1 and 12.' })
    .max(12, { message: 'Month must be between 1 and 12.' }),
})

export const PaginationQuerySchema = z.object({
  page:  z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

export type SummaryQuery    = z.infer<typeof SummaryQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
```

---

### 4.6 Barrel export — `lib/schemas/index.ts`

```ts
export * from './expense'
export * from './category'
export * from './user'
export * from './query'
```

---

## 5. Server-Side Error Utilities

### 5.1 `AppError` — typed server errors

`AppError` is a typed `Error` subclass that carries an HTTP status code and an optional machine-readable code. Throwing it inside a service function lets the API route handler respond with the correct status without coupling the service to HTTP concerns.

```ts
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public readonly message:    string,
    public readonly statusCode: number,
    public readonly code?:      string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Convenience constructors
export const Errors = {
  notFound:      (msg = 'Resource not found.') =>
    new AppError(msg, 404, 'NOT_FOUND'),

  forbidden:     (msg = 'You do not have permission to do this.') =>
    new AppError(msg, 403, 'FORBIDDEN'),

  conflict:      (msg: string, code?: string) =>
    new AppError(msg, 409, code ?? 'CONFLICT'),

  unauthenticated: () =>
    new AppError('You must be signed in to do this.', 401, 'UNAUTHENTICATED'),

  internal:      () =>
    new AppError('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR'),
}
```

---

### 5.2 `handleApiError` — centralised API error handler

Import this into every API route to convert any thrown value into a consistent `ApiErrorResponse`.

```ts
// lib/api.ts
import { NextResponse } from 'next/server'
import { ZodError }     from 'zod'
import { AppError }     from './errors'

export function handleApiError(err: unknown): NextResponse {
  // Zod validation failure — extract field messages
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return NextResponse.json(
      { error: 'Please fix the errors below.', code: 'VALIDATION_ERROR', fields },
      { status: 400 },
    )
  }

  // Known application error — use its status and message directly
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode },
    )
  }

  // Unknown error — log the real error, return a safe message
  console.error('[API] Unhandled error:', err)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
```

---

## 6. API Route Pattern

Every API route follows this structure: authenticate → validate → execute → handle errors.

### Full example — `POST /api/expenses`

```ts
// app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSession }      from '@/lib/auth/session'
import { handleApiError }      from '@/lib/api'
import { CreateExpenseSchema } from '@/lib/schemas'
import { insertExpense }       from '@/lib/services/expenseService'

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — always first
    const session = await requireSession()

    // 2. Parse and validate the request body with Zod
    const body    = await req.json()
    const payload = CreateExpenseSchema.parse(body)

    // 3. Execute — user_id always comes from the session
    const expense = await insertExpense({
      ...payload,
      user_id: session.user.id,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    // 4. Centralised error handling — one line
    return handleApiError(err)
  }
}
```

### Full example — `GET /api/summary` (query param validation)

```ts
// app/api/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSession }       from '@/lib/auth/session'
import { handleApiError }       from '@/lib/api'
import { SummaryQuerySchema }   from '@/lib/schemas'
import { getMonthlySummary }    from '@/lib/services/summaryService'
import { Errors }               from '@/lib/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession()

    // Validate query params — pass the whole searchParams as a plain object
    const { year, month } = SummaryQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )

    const summary = await getMonthlySummary(session.user.id, year, month)
    if (!summary) throw Errors.notFound('No expenses found for this period.')

    return NextResponse.json(summary)
  } catch (err) {
    return handleApiError(err)
  }
}
```

### Full example — `PATCH /api/expenses/[id]` (ownership check)

```ts
// app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSession }      from '@/lib/auth/session'
import { handleApiError }      from '@/lib/api'
import { UpdateExpenseSchema } from '@/lib/schemas'
import { updateExpense }       from '@/lib/services/expenseService'
import { Errors }              from '@/lib/errors'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession()
    const body    = await req.json()
    const payload = UpdateExpenseSchema.parse(body)

    // Service layer enforces ownership — throws Errors.notFound if id+userId don't match
    const expense = await updateExpense(params.id, session.user.id, payload)

    return NextResponse.json(expense)
  } catch (err) {
    return handleApiError(err)
  }
}
```

---

## 7. Server Action Pattern

Server Actions use `useActionState` (React 19) to return typed state back to the form. Zod validates the `FormData` before any business logic runs.

### 7.1 Action state type

```ts
// lib/actions/types.ts
export type ActionState<T = undefined> =
  | { status: 'idle' }
  | { status: 'error';   error: string; fields?: Record<string, string[]> }
  | { status: 'success'; data?: T }
```

---

### 7.2 Example — create expense Server Action

```ts
// lib/actions/expense.ts
'use server'
import { revalidatePath }      from 'next/cache'
import { requireSession }      from '@/lib/auth/session'
import { CreateExpenseSchema } from '@/lib/schemas'
import { insertExpense }       from '@/lib/services/expenseService'
import type { ActionState }    from './types'
import type { Expense }        from '@/types/models'

export async function createExpenseAction(
  _prev: ActionState<Expense>,
  formData: FormData,
): Promise<ActionState<Expense>> {
  // 1. Authenticate
  let session
  try {
    session = await requireSession()
  } catch {
    return { status: 'error', error: 'You must be signed in to do this.' }
  }

  // 2. Validate with Zod
  const result = CreateExpenseSchema.safeParse({
    category_id:  formData.get('category_id'),
    amount:       Number(formData.get('amount')),
    description:  formData.get('description'),
    notes:        formData.get('notes') || null,
    date:         formData.get('date'),
    is_recurring: formData.get('is_recurring') === 'true',
  })

  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { status: 'error', error: 'Please fix the errors below.', fields }
  }

  // 3. Execute
  try {
    const expense = await insertExpense({
      ...result.data,
      user_id: session.user.id,
    })
    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { status: 'success', data: expense }
  } catch {
    return { status: 'error', error: 'Something went wrong. Please try again.' }
  }
}
```

---

## 8. Client-Side Form Validation

Client-side validation with Zod gives immediate feedback before submitting. It is always paired with server-side validation — it is never the sole check.

### 8.1 Validate on submit

```ts
'use client'
import { CreateExpenseSchema } from '@/lib/schemas'

function useExpenseForm() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function validate(data: unknown): boolean {
    const result = CreateExpenseSchema.safeParse(data)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!errors[key]) errors[key] = issue.message   // first message per field
      }
      setFieldErrors(errors)
      return false
    }

    setFieldErrors({})
    return true
  }

  return { fieldErrors, validate }
}
```

### 8.2 Validate on blur (individual fields)

```ts
function validateField(
  schema: z.ZodTypeAny,
  value: unknown,
): string | undefined {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0].message
}

// Usage inside a component
const [amountError, setAmountError] = useState<string>()

<Input
  label="Amount"
  type="number"
  isInvalid={!!amountError}
  errorMessage={amountError}
  onBlur={e =>
    setAmountError(
      validateField(
        CreateExpenseSchema.shape.amount,
        Number(e.target.value)
      )
    )
  }
/>
```

---

## 9. HeroUI Error Display

### 9.1 Field-level errors — `Input` `errorMessage`

The `isInvalid` prop turns the field red. `errorMessage` renders the message below the field. Both come from HeroUI — no custom error styling is needed.

```tsx
<Input
  label="Description"
  name="description"
  variant="bordered"
  labelPlacement="outside"
  isRequired
  isInvalid={!!fieldErrors.description}
  errorMessage={fieldErrors.description}
/>

<Input
  label="Amount"
  name="amount"
  type="number"
  variant="bordered"
  labelPlacement="outside"
  startContent={<span className="text-default-400">$</span>}
  isRequired
  isInvalid={!!fieldErrors.amount}
  errorMessage={fieldErrors.amount}
/>

<Select
  label="Category"
  name="category_id"
  variant="bordered"
  labelPlacement="outside"
  isRequired
  isInvalid={!!fieldErrors.category_id}
  errorMessage={fieldErrors.category_id}
>
  {categories.map(c => (
    <SelectItem key={c.id}>{c.name}</SelectItem>
  ))}
</Select>
```

---

### 9.2 Form-level errors — `Alert`

When the server returns a top-level error (e.g. "Something went wrong") or the form is invalid as a whole, display it above the submit button using the HeroUI `Alert` component.

```tsx
import { Alert } from '@heroui/react'

// Inside a form component
{formError && (
  <Alert
    color="danger"
    title={formError}
    variant="flat"
  />
)}

// With a list of field errors (useful for server-rendered forms)
{formError && (
  <Alert color="danger" variant="flat" title={formError}>
    {fieldErrorList.length > 0 && (
      <ul className="list-disc list-inside mt-1">
        {fieldErrorList.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    )}
  </Alert>
)}
```

---

### 9.3 Transient notifications — `addToast`

Use `addToast` for success confirmations and non-blocking errors that don't require the user to take action.

```tsx
import { addToast } from '@heroui/toast'

// After a successful save
addToast({
  title:   'Expense saved',
  color:   'success',
  timeout: 3000,
})

// After a delete
addToast({
  title:   'Expense deleted',
  color:   'danger',
  timeout: 3000,
})

// Non-blocking background failure (e.g. summary failed to refresh)
addToast({
  title:       'Could not refresh summary',
  description: 'Your changes were saved. Try refreshing the page.',
  color:       'warning',
  timeout:     6000,
})
```

---

### 9.4 Decision guide — which component to use

| Error type | Component | When |
|---|---|---|
| Single field validation failure | `Input` / `Select` `errorMessage` | Field is invalid after blur or submit |
| Form-wide validation failure | `Alert` `color="danger"` | Server returns `fields` map or schema-level `refine` fails |
| Server error on save/delete | `Alert` `color="danger"` | API returns 4xx or 5xx during form submit |
| Success after mutation | `addToast` `color="success"` | Expense saved, category deleted, etc. |
| Non-critical background failure | `addToast` `color="warning"` | A non-essential request failed (analytics, cache refresh) |
| Unrecoverable page error | `error.tsx` | React error boundary catches a render or async error |
| Resource not found | `not-found.tsx` | `notFound()` is called in a server component |

Never use a `color="danger"` toast for a form validation error — the user needs to see which fields are wrong, not a dismissible message that disappears.

---

## 10. Full Form Component Pattern

A complete form that combines all the pieces: `useActionState`, Zod client validation, HeroUI field errors, and a form-level `Alert`.

```tsx
// components/expenses/CreateExpenseForm.tsx
'use client'
import { useActionState }      from 'react'
import { Alert, Button, Input, Select, SelectItem, Switch, DatePicker } from '@heroui/react'
import { addToast }            from '@heroui/toast'
import { createExpenseAction } from '@/lib/actions/expense'
import { CreateExpenseSchema } from '@/lib/schemas'
import type { Category }       from '@/types/models'

const initialState = { status: 'idle' } as const

export function CreateExpenseForm({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(
    createExpenseAction,
    initialState,
  )

  // Show success toast and reset when the action succeeds
  if (state.status === 'success') {
    addToast({ title: 'Expense saved', color: 'success', timeout: 3000 })
  }

  const fieldErrors = state.status === 'error' ? (state.fields ?? {}) : {}
  const formError   = state.status === 'error' ? state.error : null

  return (
    <form action={formAction} className="flex flex-col gap-4">

      {/* Form-level error */}
      {formError && (
        <Alert color="danger" variant="flat" title={formError} />
      )}

      <Input
        label="Description"
        name="description"
        variant="bordered"
        labelPlacement="outside"
        isRequired
        isInvalid={!!fieldErrors.description}
        errorMessage={fieldErrors.description?.[0]}
      />

      <Input
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0"
        variant="bordered"
        labelPlacement="outside"
        startContent={<span className="text-default-400 text-sm">$</span>}
        isRequired
        isInvalid={!!fieldErrors.amount}
        errorMessage={fieldErrors.amount?.[0]}
      />

      <Select
        label="Category"
        name="category_id"
        variant="bordered"
        labelPlacement="outside"
        isRequired
        isInvalid={!!fieldErrors.category_id}
        errorMessage={fieldErrors.category_id?.[0]}
      >
        {categories.map(c => (
          <SelectItem key={c.id}>{c.name}</SelectItem>
        ))}
      </Select>

      <DatePicker
        label="Date"
        name="date"
        variant="bordered"
        labelPlacement="outside"
        granularity="day"
        isRequired
        isInvalid={!!fieldErrors.date}
        errorMessage={fieldErrors.date?.[0]}
      />

      <Switch name="is_recurring" value="true">
        Recurring expense
      </Switch>

      <div className="flex justify-end gap-2">
        <Button variant="light" type="button">Cancel</Button>
        <Button color="primary" type="submit" isLoading={isPending}>
          Save
        </Button>
      </div>

    </form>
  )
}
```

---

## 11. Error Boundaries

### 11.1 Route-level `error.tsx`

Catches unhandled errors thrown during rendering or data fetching within a route segment. Must be a Client Component.

```tsx
// app/(app)/error.tsx
'use client'
import { useEffect }         from 'react'
import { Button, Alert }     from '@heroui/react'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to your error reporting service here (e.g. Sentry)
    // Never log to console in production
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-6 p-12">
      <Alert
        color="danger"
        variant="flat"
        title="Something went wrong"
        description="An unexpected error occurred. You can try again or return to the dashboard."
      />
      <div className="flex gap-3">
        <Button color="primary" onPress={reset}>Try again</Button>
        <Button variant="light" as="a" href="/dashboard">Go to Dashboard</Button>
      </div>
    </div>
  )
}
```

The `digest` property is a server-generated hash that identifies the error in server logs without exposing a stack trace to the client. Log it in your error monitoring service alongside the real error.

---

### 11.2 `not-found.tsx`

Rendered when `notFound()` is called in a server component — e.g. when a resource doesn't exist or belongs to another user.

```tsx
// app/(app)/not-found.tsx
import { Button } from '@heroui/react'
import Link       from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 p-12">
      <p className="text-4xl font-bold text-default-400">404</p>
      <p className="text-lg font-semibold">Page not found</p>
      <p className="text-default-500 text-center max-w-sm">
        The page you're looking for doesn't exist or you don't have access to it.
      </p>
      <Button as={Link} href="/dashboard" color="primary">
        Back to Dashboard
      </Button>
    </div>
  )
}
```

Always use a generic message for missing resources — do not distinguish between "does not exist" and "belongs to another user". Leaking that distinction is an information disclosure vulnerability.

---

### 11.3 Triggering `notFound()` safely

```tsx
// app/(app)/expenses/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { getServerSession }   from 'next-auth'
import { authOptions }        from '@/lib/auth/config'
import { fetchExpenseById }   from '@/lib/services/expenseService'

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const expense = await fetchExpenseById(params.id, session.user.id)

  // If expense is null (doesn't exist OR belongs to another user),
  // render the not-found page — do not distinguish between the two
  if (!expense) notFound()

  return <ExpenseDetail expense={expense} />
}
```

---

## 12. Server-Side Logging Rules

Log real errors on the server. Never send them to the client.

```ts
// ✓ Server-side: log the real error with context
console.error('[POST /api/expenses] Failed to insert:', err)

// ✓ Client response: safe message only
return NextResponse.json(
  { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
  { status: 500 }
)
```

### What to log

Every server error log must include:
1. The handler or function name in brackets — `[POST /api/expenses]`
2. A short description of what failed — `'Failed to insert expense'`
3. The raw error object — `err`

```ts
// Consistent format across all route files
console.error('[PATCH /api/expenses/[id]] Failed to update:', err)
console.error('[GET /api/categories] Failed to fetch categories:', err)
console.error('[deleteExpense service] Supabase returned error:', err)
```

### What never goes into a log

- Passwords, tokens, or session values
- Full request bodies that may contain user PII
- API keys or environment variable values

---

## 13. Anti-Patterns — Never Do These

```ts
// ✗ Ad-hoc validation instead of Zod
if (!body.description || !body.amount) {
  return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
}

// ✗ Sending raw error messages to the client
return NextResponse.json({ error: err.message }, { status: 500 })

// ✗ Sending a stack trace to the client
return NextResponse.json({ error: err.stack }, { status: 500 })

// ✗ Logging sensitive data
console.error('Auth failed for user:', session.user, 'token:', token)

// ✗ Using console.log in API routes for non-error output
console.log('Creating expense:', payload)

// ✗ Different error shapes from different routes
// Route A: { error: string }
// Route B: { message: string }
// Route C: { errors: string[] }

// ✗ Custom error UI that bypasses HeroUI
<div className="bg-red-100 text-red-800 p-3 rounded">
  {errorMessage}
</div>

// ✗ Catching errors silently
try {
  await insertExpense(payload)
} catch {
  // ignored
}

// ✗ Distinguishing "not found" from "forbidden" in the response
// (information disclosure)
if (!expense) return notFoundResponse()
if (expense.user_id !== session.user.id) return forbiddenResponse()
// Both cases should return 404
```

---

## 14. Validation Checklist

Before shipping any new form, API route, or Server Action, verify all of the following.

**Schemas**
- [ ] A Zod schema exists in `lib/schemas/` for every input this feature accepts
- [ ] Every field has a specific, user-friendly `message` on each constraint
- [ ] Query params use `z.coerce` where type conversion is needed

**API Routes**
- [ ] `requireSession()` is called before any validation or business logic
- [ ] The request body or query string is validated with `.parse()` (throws) or `.safeParse()` (manual handling)
- [ ] Every `catch` block routes through `handleApiError(err)`
- [ ] No raw `err.message` or `err.stack` is included in any response

**Server Actions**
- [ ] `safeParse()` is used and the `fields` map is returned on failure
- [ ] A top-level `error` string is always set when `status: 'error'` is returned
- [ ] `revalidatePath()` is called on success for every affected route

**Forms**
- [ ] Every `Input`, `Select`, `DatePicker` has `isInvalid` and `errorMessage` wired to field state
- [ ] A form-level `Alert` `color="danger"` is rendered when `state.status === 'error'`
- [ ] `addToast` fires on success
- [ ] The submit `Button` has `isLoading={isPending}`

**Error Boundaries**
- [ ] `error.tsx` exists in `app/(app)/`
- [ ] `not-found.tsx` exists in `app/(app)/`
- [ ] Server components call `notFound()` when a resource is missing — not a conditional render
