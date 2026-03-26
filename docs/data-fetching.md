# Data Fetching Specification

**Stack:** Next.js 16.2.1 App Router · React 19 · NextAuth v4 · Supabase · TypeScript

---

## 1. Core Rules

These apply to every data fetch in the application — no exceptions.

1. **All data fetching happens in Server Components.** Pages and layouts under `app/(app)/` are async Server Components. They call service functions directly and pass data down to Client Components as props. No data fetching happens inside Client Components.

2. **Never fetch data through this app's own API routes.** Server Components call `lib/services/*` directly — they do not call `fetch('/api/expenses')` or any equivalent. The API routes under `app/api/` exist solely for external consumers (future mobile clients, scripts, third-party integrations). This app never routes a data read through its own HTTP layer.

3. **Every fetch authenticates first.** `requireSession()` is called before any service function. A Server Component that reads user data without verifying the session is a security defect.

4. **`user_id` always comes from the session.** The session is the only trusted identity source. A `userId` received from `params`, `searchParams`, or any other client-controlled input is never passed directly to a service function without being overridden by `session.user.id`.

5. **Users can only read their own data.** Every service function that touches user-scoped tables accepts `userId` as a required parameter and filters by it. No unscoped `SELECT *` runs on protected tables.

6. **Independent fetches run in parallel.** Sequential `await` chains are a performance defect. Unrelated fetches are always started together and awaited with `Promise.all`.

7. **`React.cache()` wraps every service function.** Deduplicates repeated calls to the same service function within a single request — prevents multiple server components from issuing redundant DB round-trips for the same data.

---

## 2. Why Server Components — Not Client Fetching or API Routes

### The hierarchy

```
Server Component (page.tsx)
    │
    │  calls directly
    ▼
lib/services/*  (service layer)
    │
    │  queries via supabaseAdmin
    ▼
Supabase (PostgreSQL)
```

Client Components never appear in this chain. This app's API routes never appear in this chain for reads originating from this app's own UI.

### Comparison

| Concern | Server Component + Service | Client fetch / SWR | API Route (self-call) |
|---|---|---|---|
| Data exposed to browser | Only what is explicitly passed as props | Full response payload | Full response payload |
| Auth enforcement | Server-only — not accessible from the browser | Must be re-checked on every call | Must be checked in every handler |
| Network round-trips | Zero — runs in the same process | One per component mount | One per component mount |
| TypeScript safety | End-to-end — service return type flows into JSX | Manually typed fetch response | Manually typed fetch response |
| Bundle size | No fetch client shipped to the browser | Fetching library in bundle | Fetching library in bundle |
| Loading states | `loading.tsx` + `<Suspense>` — automatic | Manual `isLoading` state | Manual `isLoading` state |
| Sensitive data leakage | Impossible — data never leaves the server | Risk if too much is returned | Risk if too much is returned |

---

## 3. File Structure

Service functions are the only data access layer. They are called from Server Components. They are never called from Client Components.

```
lib/
└── services/
    ├── expenseService.ts     # fetchExpensesByUser, fetchExpenseById, fetchExpenses (paginated)
    ├── categoryService.ts    # fetchCategoriesByUser, fetchDefaultCategories
    ├── summaryService.ts     # getMonthlySummary, getReportData
    └── userService.ts        # fetchUserById
```

### Naming conventions

| Pattern | Example |
|---|---|
| File name — camelCase, singular noun + `Service` | `expenseService.ts` |
| Function name — verb + noun | `fetchExpensesByUser`, `getMonthlySummary` |
| Export — named, never default | `export const fetchExpensesByUser = cache(async (...) => ...)` |
| Wrapped in `React.cache()` | All service functions — see section 6 |

---

## 4. The Standard Fetch Pattern

Every data-fetching page follows this structure: authenticate → fetch → render.

```tsx
// app/(app)/expenses/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth/config'
import { redirect }         from 'next/navigation'
import { fetchExpensesByUser }  from '@/lib/services/expenseService'
import { fetchCategoriesByUser } from '@/lib/services/categoryService'
import { ExpensesView }     from '@/components/expenses/ExpensesView'

export default async function ExpensesPage() {
  // 1. Authenticate — always first
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  // 2. Fetch — user_id always from session
  const [expenses, categories] = await Promise.all([
    fetchExpensesByUser(session.user.id),
    fetchCategoriesByUser(session.user.id),
  ])

  // 3. Render — pass only the fields each component needs
  return <ExpensesView expenses={expenses} categories={categories} />
}
```

### Single-resource pages

For detail or edit pages, always pass `session.user.id` alongside `params.id`. The service layer confirms ownership and returns `null` if the record does not exist or belongs to another user. Treat both cases identically — call `notFound()`.

```tsx
// app/(app)/expenses/[id]/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth/config'
import { redirect, notFound } from 'next/navigation'
import { fetchExpenseById } from '@/lib/services/expenseService'
import { ExpenseDetail }    from '@/components/expenses/ExpenseDetail'

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const expense = await fetchExpenseById(params.id, session.user.id)

  // Do NOT distinguish "not found" from "belongs to another user" —
  // returning different responses is an information disclosure vulnerability
  if (!expense) notFound()

  return <ExpenseDetail expense={expense} />
}
```

### Pages with search params

Query strings are always strings. Validate and coerce them with Zod before passing to service functions. Do not pass raw `searchParams` values into service calls.

```tsx
// app/(app)/expenses/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth/config'
import { redirect }         from 'next/navigation'
import { fetchExpenses }    from '@/lib/services/expenseService'
import { ExpenseQuerySchema } from '@/lib/schemas/query'
import { ExpensesView }     from '@/components/expenses/ExpensesView'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  // Validate and coerce query params — never pass raw strings to services
  const parsed = ExpenseQuerySchema.safeParse(searchParams)
  const filters = parsed.success
    ? parsed.data
    : { page: 1, limit: 25 }   // safe defaults on invalid input

  const { expenses, total } = await fetchExpenses(session.user.id, filters)

  return <ExpensesView expenses={expenses} total={total} filters={filters} />
}
```

---

## 5. Service Layer — Authorization Rules

Service functions are the final application-level enforcement point before the database. Every function that touches a user-scoped table must:

1. Accept `userId: string` as a required parameter
2. Filter every query by `user_id` using `.eq('user_id', userId)`
3. Never derive `userId` internally — it must always come from the call site, which sources it from `session.user.id`

```ts
// lib/services/expenseService.ts
import { cache }         from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { Errors }        from '@/lib/errors'
import type { Expense }  from '@/types/models'

// List — scoped to user, ordered by date
export const fetchExpensesByUser = cache(async (userId: string): Promise<Expense[]> => {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('user_id', userId)        // ← ownership enforced at query level
    .order('date', { ascending: false })

  if (error) throw error
  return data ?? []
})

// Single — scoped to both id and user
// Returns null if not found OR if it belongs to another user — callers cannot tell the difference
export const fetchExpenseById = cache(async (
  id: string,
  userId: string,
): Promise<Expense | null> => {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('id', userId)
    .eq('user_id', userId)        // ← ownership enforced — no cross-user access possible
    .single()

  if (error?.code === 'PGRST116') return null   // PostgREST "no rows returned"
  if (error) throw error
  return data
})
```

```ts
// lib/services/categoryService.ts
import { cache }         from 'react'
import { supabaseAdmin } from '@/lib/supabaseClient'
import type { Category } from '@/types/models'

// Returns user's own categories AND global defaults (user_id IS NULL)
export const fetchCategoriesByUser = cache(async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .order('name')

  if (error) throw error
  return data ?? []
})
```

---

## 6. `React.cache()` — Per-Request Deduplication

Wrap every service function in `React.cache()`. If two server components in the same render tree call `fetchCategoriesByUser(userId)` with the same argument, the database is only queried once.

`React.cache()` deduplicates within a single request only. It does not persist between requests.

```ts
// ✓ Correct — wrapped in React.cache()
import { cache } from 'react'

export const fetchCategoriesByUser = cache(async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .order('name')

  if (error) throw error
  return data ?? []
})
```

```ts
// ✗ Without React.cache() — two components calling this in the same tree = two DB queries
export async function fetchCategoriesByUser(userId: string): Promise<Category[]> { ... }
```

**Pass primitive values only.** `React.cache()` uses `Object.is` equality to match arguments. Two separate `{ userId }` objects will never match each other.

```ts
// ✗ Object argument — always a cache miss
fetchExpenses({ userId, page })

// ✓ Primitive arguments — cache hits correctly
fetchExpenses(userId, page)
```

### Cross-request caching for stable data

For data that does not change between requests — such as global default categories — use an LRU cache at module scope so repeated requests share a single DB fetch.

```ts
// lib/services/categoryService.ts
import { LRUCache } from 'lru-cache'
import type { Category } from '@/types/models'

const defaultCategoryCache = new LRUCache<string, Category[]>({
  max: 1,
  ttl: 5 * 60 * 1000,   // 5 minutes
})

export async function fetchDefaultCategories(): Promise<Category[]> {
  const cached = defaultCategoryCache.get('default')
  if (cached) return cached

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .is('user_id', null)
    .eq('is_default', true)
    .order('name')

  if (error) throw error
  const result = data ?? []
  defaultCategoryCache.set('default', result)
  return result
}
```

---

## 7. Parallel Fetching — Eliminating Waterfalls

Sequential `await` chains are the single largest performance defect in Server Component data fetching. Each one adds a full DB round-trip to the critical path before the page can render.

### `Promise.all` for independent fetches

When two or more fetches do not depend on each other's results, start them simultaneously.

```ts
// ✗ Sequential — three round trips in series before the page renders
const session    = await getServerSession(authOptions)
const expenses   = await fetchExpensesByUser(session.user.id)
const categories = await fetchCategoriesByUser(session.user.id)

// ✓ Parallel — session resolves, then both fetches start together
const session = await getServerSession(authOptions)
if (!session?.user?.id) redirect('/login')

const [expenses, categories] = await Promise.all([
  fetchExpensesByUser(session.user.id),
  fetchCategoriesByUser(session.user.id),
])
```

### Partially dependent fetches

When fetch C is independent but fetch B depends on fetch A, start C immediately — do not wait for A to finish first.

```ts
// ✗ Three sequential round trips — summary waits for session, categories wait for summary
const session  = await getServerSession(authOptions)
const summary  = await getMonthlySummary(session.user.id, year, month)
const categories = await fetchCategoriesByUser(session.user.id)

// ✓ session and categories start simultaneously; summary waits for session only
const sessionPromise   = getServerSession(authOptions)
const defaultCatPromise = fetchDefaultCategories()   // independent, start immediately

const session = await sessionPromise
if (!session?.user?.id) redirect('/login')

const [summary, defaultCategories] = await Promise.all([
  getMonthlySummary(session.user.id, year, month),
  defaultCatPromise,
])
```

### Component composition for parallel subtree fetches

When a page has several independent data-fetching sections, decompose it into async Server Components that each own their own fetch. React renders sibling components in parallel.

```tsx
// ✗ Sidebar and RecentExpenses wait for each other
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const summary  = await getMonthlySummary(session.user.id, year, month)
  const expenses = await fetchExpensesByUser(session.user.id)   // waits for summary

  return (
    <div>
      <SummaryCards summary={summary} />
      <RecentExpenses expenses={expenses} />
    </div>
  )
}

// ✓ Each section fetches independently — React renders them in parallel
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  return (
    <div>
      <SummaryCards userId={session.user.id} />    {/* fetches in parallel */}
      <RecentExpenses userId={session.user.id} />  {/* fetches in parallel */}
    </div>
  )
}

async function SummaryCards({ userId }: { userId: string }) {
  const summary = await getMonthlySummary(userId, currentYear, currentMonth)
  return <SummaryCardsView summary={summary} />
}

async function RecentExpenses({ userId }: { userId: string }) {
  const expenses = await fetchExpensesByUser(userId)
  return <RecentExpensesView expenses={expenses} />
}
```

---

## 8. Streaming with Suspense

Wrap slow data-dependent sections in `<Suspense>` so the surrounding layout renders immediately while the slow query runs in the background. The `loading.tsx` file in each route directory is the automatic `<Suspense>` boundary for the entire page — use it for page-level loading states. Use explicit `<Suspense>` for section-level streaming within a page.

### `loading.tsx` — page-level skeleton

Every page inside `app/(app)/` that fetches data must have a sibling `loading.tsx`. This wraps the page in `<Suspense>` automatically so the Navbar and Sidebar render immediately.

```tsx
// app/(app)/expenses/loading.tsx
import { Skeleton } from '@heroui/react'

export default function ExpensesLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
```

### Explicit `<Suspense>` for section-level streaming

Use when one section of a page is slow and the rest should be visible immediately.

```tsx
// app/(app)/dashboard/page.tsx
import { Suspense } from 'react'
import { Skeleton } from '@heroui/react'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Fast — renders immediately */}
      <WelcomeHeader userId={session.user.id} />

      {/* Slow monthly aggregate — streams in while the rest is visible */}
      <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
        <MonthlySummary userId={session.user.id} />
      </Suspense>

      {/* Medium — streams in independently */}
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <RecentExpenses userId={session.user.id} />
      </Suspense>
    </div>
  )
}

async function MonthlySummary({ userId }: { userId: string }) {
  const summary = await getMonthlySummary(userId, currentYear, currentMonth)
  return <SummaryCards summary={summary} />
}

async function RecentExpenses({ userId }: { userId: string }) {
  const expenses = await fetchExpensesByUser(userId)
  return <RecentExpensesView expenses={expenses} />
}
```

**When NOT to use `<Suspense>`:**
- Data that affects page layout dimensions — the skeleton must match the content size
- SEO-critical above-the-fold content that search engines need to index
- Queries that complete in under ~100 ms — the skeleton flash is worse than the wait

---

## 9. Passing Data to Client Components

Client Components receive data as props from their Server Component parent. They never fetch data themselves.

### Pass only the fields the component needs

Everything passed across the Server/Client boundary is serialised into the HTML payload. Pass individual fields, not whole objects, to keep payload size minimal.

```tsx
// ✗ Serialises all 12 fields of Expense — most are unused by this component
async function Page() {
  const expense = await fetchExpenseById(id, userId)
  return <ExpenseRow expense={expense} />
}

// ✓ Serialises only what the component renders
async function Page() {
  const expense = await fetchExpenseById(id, userId)
  if (!expense) notFound()

  return (
    <ExpenseRow
      id={expense.id}
      description={expense.description}
      amount={expense.amount}
      date={expense.date}
      categoryId={expense.category_id}
    />
  )
}
```

### Never pass `session` to Client Components

The session object from `getServerSession` contains JWT metadata. Pass only the fields the component needs.

```tsx
// ✗ Passes session fields the component doesn't need (and shouldn't have)
<UserMenu session={session} />

// ✓ Pass only what the component renders
<UserMenu name={session.user.name ?? ''} email={session.user.email ?? ''} />
```

---

## 10. What Client Components May Do

Client Components handle interactivity, not data fetching. The table below defines the boundary.

| Allowed in Client Components | Not allowed in Client Components |
|---|---|
| Read `session.user.name`, `session.user.email`, `session.user.image` via `useSession()` | Call `getServerSession()` — server-only |
| Accept pre-fetched data as props | Call any `lib/services/*` function |
| Call Server Actions for mutations (`createExpenseAction`, etc.) | Call `fetch('/api/expenses')` or any other data-fetching API route for initial data |
| Use `useOptimistic` to reflect mutation results immediately | Use `useEffect` + `fetch` to load initial data |
| Use `useSearchParams` to read filter state | Issue their own DB queries |
| Trigger `router.refresh()` after a successful mutation | — |

---

## 11. Error Handling in Fetches

### Missing resources — `notFound()`

When a resource is not found or does not belong to the authenticated user, call `notFound()`. Do not return an empty state or render a custom "not found" message inline — use the route's `not-found.tsx`.

```tsx
// ✓ Correct — always treat "not found" and "wrong user" identically
const expense = await fetchExpenseById(params.id, session.user.id)
if (!expense) notFound()
```

### Service errors — let them throw

Service functions throw on DB errors. Server Components do not catch these — they propagate to the nearest `error.tsx` boundary. Do not swallow errors in pages or catch them for generic `try/catch` wrappers.

```tsx
// ✗ Swallowing the error — user sees empty state instead of the real error boundary
export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  try {
    const expenses = await fetchExpensesByUser(session.user.id)
    return <ExpensesView expenses={expenses} />
  } catch {
    return <p>Failed to load expenses.</p>   // bypasses error.tsx
  }
}

// ✓ Let the error propagate to error.tsx — the boundary handles it consistently
export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const expenses = await fetchExpensesByUser(session.user.id)
  return <ExpensesView expenses={expenses} />
}
```

---

## 12. Anti-Patterns — Never Do These

```tsx
// ✗ Fetching data inside a Client Component with useEffect + fetch
'use client'
export function ExpenseList() {
  const [expenses, setExpenses] = useState([])
  useEffect(() => {
    fetch('/api/expenses').then(r => r.json()).then(setExpenses)
  }, [])
}

// ✗ Fetching data inside a Client Component with SWR
'use client'
export function ExpenseList() {
  const { data } = useSWR('/api/expenses', fetcher)
}

// ✗ Server Component calling its own API route via fetch
export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  // Unnecessary HTTP round-trip — call the service function directly
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/expenses`, {
    headers: { Cookie: cookies().toString() },
  })
  const expenses = await res.json()
}

// ✗ Reading user_id from searchParams and passing it to a service
export default async function ExpensesPage({ searchParams }: Props) {
  // Trivially spoofable — user can pass any user_id in the URL
  const expenses = await fetchExpensesByUser(searchParams.userId)
}

// ✗ Using getServerSession without authOptions — returns null in NextAuth v4
const session = await getServerSession()

// ✗ Calling a service function before verifying the session
export default async function ExpensesPage() {
  const expenses = await fetchExpensesByUser(???)   // no session yet
  const session  = await getServerSession(authOptions)
}

// ✗ Service function without userId — unscoped read, returns all users' data
export async function fetchAllExpenses(): Promise<Expense[]> {
  const { data } = await supabaseAdmin.from('expenses').select('*')
  return data ?? []
}

// ✗ Passing entire session object as a prop to a Client Component
<ClientNav session={session} />   // serialises JWT metadata into HTML

// ✗ Missing React.cache() on a service function called by multiple components
export async function fetchCategoriesByUser(userId: string) { ... }
// Two server components calling this = two DB queries
```

---

## 13. Data Fetching Checklist

Run through this before shipping any page that reads data.

**Authentication**
- [ ] `getServerSession(authOptions)` is called before any service function
- [ ] The page redirects to `/login` if `!session?.user?.id`
- [ ] `userId` is sourced exclusively from `session.user.id` — never from `params` or `searchParams`

**Service calls**
- [ ] Each service function is wrapped in `React.cache()`
- [ ] Every service function accepts `userId: string` and filters by `user_id`
- [ ] Independent fetches use `Promise.all` — no sequential `await` chains
- [ ] No `fetch('/api/*')` calls appear inside Server Components

**Client boundary**
- [ ] Client Components receive pre-fetched data as props — they do not fetch anything
- [ ] Only the fields the component renders are passed across the boundary — not whole objects
- [ ] Session data passed to Client Components is limited to `name`, `email`, `image`

**Loading and error states**
- [ ] A `loading.tsx` file exists alongside every page that fetches data
- [ ] `notFound()` is called when a resource is missing — not a conditional render
- [ ] Service errors are allowed to propagate to `error.tsx` — not swallowed in pages

**Search params**
- [ ] Query strings are validated and coerced with a Zod schema before being passed to services
- [ ] Safe defaults are applied when query params fail validation
