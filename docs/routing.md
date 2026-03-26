# Routing Specification

**Framework:** Next.js 16.2.1 App Router
**Convention:** File-system routing — every folder under `app/` with a `page.tsx` becomes a URL segment.

---

## 1. Core Principles

1. **All routes under `app/` are protected by default.** Unauthenticated requests are intercepted by middleware and redirected to `/login` before any page or API handler executes. See `docs/auth.md` for the full protection implementation.

2. **Route groups separate concerns, not URLs.** The `(auth)` and `(app)` route groups organise layouts and middleware scope — they do not appear in the URL.

3. **URLs are kebab-case, resource-based, and predictable.** A URL should read like a sentence about the resource it represents: `/expenses`, `/expenses/[id]/edit`, `/categories`.

4. **API routes mirror UI routes in naming.** The API route for a resource lives at `app/api/<resource>/route.ts` and matches the plural noun of the UI route: `/expenses` UI → `/api/expenses` API.

5. **Dynamic segments are lowercase and use the `[id]` convention.** No uppercase, no camelCase in URL segments.

---

## 2. Route Group Architecture

Route groups use parenthesised folder names — `(group)` — to share layouts without affecting URLs.

```
app/
├── (public)/           # No auth required, no shared layout
├── (auth)/             # Auth pages — login, register
│   └── layout.tsx      # Centred card layout, no sidebar/navbar
└── (app)/              # All protected pages
    └── layout.tsx      # Verifies session, renders shell: Navbar + Sidebar + BottomNav
```

### Why three groups

| Group | Auth required | Layout | Routes inside |
|---|---|---|---|
| `(public)` | No | None | `/` (marketing/landing) |
| `(auth)` | No (redirects away if signed in) | Auth card layout | `/login`, `/register` |
| `(app)` | Yes (redirects to `/login` if not) | Full app shell | All feature pages |

Middleware enforces access at the edge — the `(app)` layout is a second server-side guard. See `docs/auth.md` § 7 and § 9.

---

## 3. Complete Route Map

### 3.1 Public Routes

| URL | File | Description |
|---|---|---|
| `/` | `app/(public)/page.tsx` | Landing / marketing page |

---

### 3.2 Auth Routes — `(auth)` group

Not accessible to authenticated users — middleware redirects them to `/dashboard`.

| URL | File | Description |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Sign in with credentials or Google |
| `/register` | `app/(auth)/register/page.tsx` | Create a new account |

---

### 3.3 App Routes — `(app)` group

Every route in this group requires a valid session. Middleware redirects unauthenticated users to `/login?callbackUrl=<original-path>`.

#### Dashboard

| URL | File | Description |
|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Monthly summary cards, category breakdown, recent expenses |

The root `/` redirects to `/dashboard` for authenticated users and to `/login` for unauthenticated users. There is no content at `/` in the authenticated shell.

---

#### Expenses

| URL | File | Description |
|---|---|---|
| `/expenses` | `app/(app)/expenses/page.tsx` | Paginated, filterable expense list |
| `/expenses/[id]` | `app/(app)/expenses/[id]/page.tsx` | Read-only expense detail view |
| `/expenses/[id]/edit` | `app/(app)/expenses/[id]/edit/page.tsx` | Edit an existing expense |

Add and delete are handled through modals on `/expenses`, not separate routes. Only the edit view warrants its own route because it is a full form with its own URL state.

---

#### Categories

| URL | File | Description |
|---|---|---|
| `/categories` | `app/(app)/categories/page.tsx` | Category grid with active/archived tabs |

Add and edit categories are handled via modals on `/categories`.

---

#### Reports

| URL | File | Description |
|---|---|---|
| `/reports` | `app/(app)/reports/page.tsx` | Month-over-month and top-category tables, period selector |

---

#### Settings

| URL | File | Description |
|---|---|---|
| `/settings` | `app/(app)/settings/page.tsx` | Profile, preferences, danger zone |
| `/settings/profile` | `app/(app)/settings/profile/page.tsx` | Edit display name and email |
| `/settings/preferences` | `app/(app)/settings/preferences/page.tsx` | Currency, theme, monthly budget |

`/settings` redirects to `/settings/profile` as the default sub-page.

---

### 3.4 API Routes

All API routes live under `app/api/`. They follow REST conventions: noun-first, plural, with `[id]` for single-resource operations.

Every API route calls `requireSession()` before any logic. The `user_id` is always sourced from the session — never from the request. See `docs/auth.md` § 10.

#### Auth

| Method | URL | File | Description |
|---|---|---|---|
| GET / POST | `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | NextAuth handler — OAuth callbacks, sign-in, sign-out, session |

This route is the only one excluded from the authentication middleware. It must remain publicly reachable.

---

#### Expenses

| Method | URL | File | Description |
|---|---|---|---|
| GET | `/api/expenses` | `app/api/expenses/route.ts` | List all expenses for the authenticated user |
| POST | `/api/expenses` | `app/api/expenses/route.ts` | Create a new expense |
| GET | `/api/expenses/[id]` | `app/api/expenses/[id]/route.ts` | Fetch a single expense by ID |
| PATCH | `/api/expenses/[id]` | `app/api/expenses/[id]/route.ts` | Partial update of an expense |
| DELETE | `/api/expenses/[id]` | `app/api/expenses/[id]/route.ts` | Delete an expense |

---

#### Categories

| Method | URL | File | Description |
|---|---|---|---|
| GET | `/api/categories` | `app/api/categories/route.ts` | List the user's categories and global defaults |
| POST | `/api/categories` | `app/api/categories/route.ts` | Create a new user-owned category |
| PATCH | `/api/categories/[id]` | `app/api/categories/[id]/route.ts` | Update a category (name, is_archived) |
| DELETE | `/api/categories/[id]` | `app/api/categories/[id]/route.ts` | Delete a user-owned category |

---

#### Summary

| Method | URL | File | Description |
|---|---|---|---|
| GET | `/api/summary` | `app/api/summary/route.ts` | Monthly aggregate for the authenticated user |

Query params: `?year=2026&month=3`

---

#### User

| Method | URL | File | Description |
|---|---|---|---|
| GET | `/api/user` | `app/api/user/route.ts` | Fetch the authenticated user's profile |
| PATCH | `/api/user` | `app/api/user/route.ts` | Update display name, currency, or budget |
| DELETE | `/api/user` | `app/api/user/route.ts` | Delete account and cascade all user data |

---

## 4. Complete File Tree

The full `app/` structure that implements every route above:

```
app/
│
├── (public)/
│   └── page.tsx                              # /  (landing page)
│
├── (auth)/
│   ├── layout.tsx                            # Centred card shell, no sidebar
│   ├── login/
│   │   └── page.tsx                          # /login
│   └── register/
│       └── page.tsx                          # /register
│
├── (app)/
│   ├── layout.tsx                            # Protected shell — session guard + Navbar + Sidebar
│   │
│   ├── dashboard/
│   │   ├── page.tsx                          # /dashboard
│   │   └── loading.tsx                       # Skeleton shown during server fetch
│   │
│   ├── expenses/
│   │   ├── page.tsx                          # /expenses
│   │   ├── loading.tsx
│   │   └── [id]/
│   │       ├── page.tsx                      # /expenses/[id]
│   │       └── edit/
│   │           ├── page.tsx                  # /expenses/[id]/edit
│   │           └── loading.tsx
│   │
│   ├── categories/
│   │   ├── page.tsx                          # /categories
│   │   └── loading.tsx
│   │
│   ├── reports/
│   │   ├── page.tsx                          # /reports
│   │   └── loading.tsx
│   │
│   └── settings/
│       ├── page.tsx                          # /settings  (redirects to /settings/profile)
│       ├── layout.tsx                        # Settings sub-navigation tabs
│       ├── profile/
│       │   └── page.tsx                      # /settings/profile
│       └── preferences/
│           └── page.tsx                      # /settings/preferences
│
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts                      # /api/auth/*  (NextAuth)
│   ├── expenses/
│   │   ├── route.ts                          # GET /api/expenses  POST /api/expenses
│   │   └── [id]/
│   │       └── route.ts                      # GET PATCH DELETE /api/expenses/[id]
│   ├── categories/
│   │   ├── route.ts                          # GET /api/categories  POST /api/categories
│   │   └── [id]/
│   │       └── route.ts                      # PATCH DELETE /api/categories/[id]
│   ├── summary/
│   │   └── route.ts                          # GET /api/summary
│   └── user/
│       └── route.ts                          # GET PATCH DELETE /api/user
│
├── layout.tsx                                # Root layout — HeroUIProvider, SessionProvider, fonts
├── globals.css                               # Tailwind base + CSS custom properties
├── not-found.tsx                             # Global 404 page
└── error.tsx                                 # Global error boundary
```

---

## 5. Special Files

Next.js App Router reserves specific filenames for behaviour beyond page rendering. Use them consistently.

| File | Purpose | Required in |
|---|---|---|
| `layout.tsx` | Wraps all child routes; persists across navigations | Root, `(auth)`, `(app)`, `settings/` |
| `page.tsx` | Renders the UI for a route segment | Every routable URL |
| `loading.tsx` | Automatic Suspense boundary shown during server fetches | Every page that fetches data |
| `error.tsx` | Catches render and data errors for a subtree | Root and `(app)/` |
| `not-found.tsx` | Rendered when `notFound()` is called | Root |
| `route.ts` | HTTP handler — defines GET, POST, PATCH, DELETE exports | Every API endpoint |

### `loading.tsx` — always provide one

Every page inside `(app)/` that performs server-side data fetching must have a sibling `loading.tsx`. This automatically wraps the page in a `<Suspense>` boundary, so the shared layout (Navbar, Sidebar) renders instantly while data loads.

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

### `error.tsx` — must be a Client Component

```tsx
// app/(app)/error.tsx
'use client'
import { Button } from '@heroui/react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-12">
      <p className="text-danger">Something went wrong.</p>
      <Button color="primary" onPress={reset}>Try again</Button>
    </div>
  )
}
```

### `not-found.tsx`

```tsx
// app/not-found.tsx
import { Button } from '@heroui/react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 p-12">
      <p className="text-2xl font-semibold">Page not found</p>
      <Button as={Link} href="/dashboard" color="primary">
        Go to Dashboard
      </Button>
    </div>
  )
}
```

---

## 6. Route Protection — Middleware

Middleware intercepts every request at the edge before any page or API handler runs. The full implementation is documented in `docs/auth.md` § 7. The summary:

```
Request arrives
    │
    ▼
proxy.ts  ──── is path in PUBLIC_PATHS? ──── yes ──▶ NextResponse.next()
    │                                                            │
    no                                           is user authed + hitting /login?
    │                                                            │
    ▼                                                           yes
does req.nextauth.token exist?                                   │
    │                                                            ▼
   no ──────────────────────────────────────────▶ redirect(/dashboard)
    │
   yes
    │
    ▼
NextResponse.next()
```

**Public paths allowlist** (everything else is blocked without a token):

```ts
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth',   // NextAuth callbacks must be reachable without a session
]
```

**The `(app)` layout is a second gate.** Even if middleware is misconfigured, `app/(app)/layout.tsx` calls `getServerSession(authOptions)` and redirects to `/login` if no session is found. Two independent checks — neither alone is sufficient.

---

## 7. Naming Conventions

### URL segments

| Rule | Correct | Wrong |
|---|---|---|
| Kebab-case only | `/monthly-summary` | `/monthlySummary`, `/monthly_summary` |
| Plural nouns for collections | `/expenses`, `/categories` | `/expense`, `/category` |
| Singular noun for actions scoped to a single resource | `/expenses/[id]/edit` | `/expenses/edit/[id]` |
| No verbs in URLs | `/expenses/[id]` with `DELETE` method | `/expenses/delete/[id]` |
| No file extensions | `/dashboard` | `/dashboard.html` |

### Dynamic segments

| Pattern | Use case | Example |
|---|---|---|
| `[id]` | Single resource by primary key | `/expenses/[id]` |
| `[slug]` | Human-readable identifier | `/categories/[slug]` |
| `[...segments]` | Catch-all (NextAuth only) | `/api/auth/[...nextauth]` |

### Route files

| File | Convention | Example |
|---|---|---|
| Pages | `page.tsx` (always) | `app/(app)/expenses/page.tsx` |
| Layouts | `layout.tsx` (always) | `app/(app)/layout.tsx` |
| API routes | `route.ts` (always) | `app/api/expenses/route.ts` |
| Loading states | `loading.tsx` (always) | `app/(app)/expenses/loading.tsx` |
| Error boundaries | `error.tsx` (always) | `app/(app)/error.tsx` |

All file names are lowercase. No exceptions.

---

## 8. Navigation Patterns

### Server components — use `redirect()`

```tsx
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  // Redirect /settings to the default sub-page
  redirect('/settings/profile')
}
```

### Client components — use `<Link>` for navigation

```tsx
import Link from 'next/link'
import { Button } from '@heroui/react'

// Inline link
<Link href="/expenses">View all expenses</Link>

// HeroUI Button as a link
<Button as={Link} href="/expenses/new" color="primary">
  Add Expense
</Button>
```

### Client components — use `useRouter()` for programmatic navigation

```tsx
'use client'
import { useRouter } from 'next/navigation'

function DeleteButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()

  async function handleDelete() {
    await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
    router.push('/expenses')
    router.refresh()   // revalidates the server component cache
  }

  return <Button color="danger" onPress={handleDelete}>Delete</Button>
}
```

Always call `router.refresh()` after a mutation to invalidate the server component cache for the current route.

### After a Server Action — use `revalidatePath()`

```ts
'use server'
import { revalidatePath } from 'next/cache'

export async function createExpenseAction(data: InsertExpense) {
  await insertExpense(data)
  revalidatePath('/expenses')       // invalidates the list
  revalidatePath('/dashboard')      // invalidates the summary cards
}
```

---

## 9. Search Params Conventions

Search params are used for filters, pagination, and transient UI state that should survive a page refresh or share via URL.

### Expense list filters

| Param | Type | Example | Purpose |
|---|---|---|---|
| `month` | `YYYY-MM` | `?month=2026-03` | Filter by month |
| `category` | UUID | `?category=c000...` | Filter by category ID |
| `q` | string | `?q=lunch` | Description search |
| `page` | integer | `?page=2` | Pagination |
| `sort` | `date\|amount` | `?sort=amount` | Sort column |
| `order` | `asc\|desc` | `?order=desc` | Sort direction |

### Report period

| Param | Type | Example | Purpose |
|---|---|---|---|
| `period` | `3m\|6m\|12m` | `?period=6m` | Report window |

### Reading search params in server components

```tsx
// app/(app)/expenses/page.tsx
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { month?: string; category?: string; q?: string; page?: string }
}) {
  const page     = Number(searchParams.page ?? '1')
  const month    = searchParams.month
  const category = searchParams.category
  const query    = searchParams.q

  const expenses = await fetchExpenses({ page, month, category, query })

  return <ExpensesView expenses={expenses} />
}
```

### Reading search params in client components

```tsx
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function MonthFilter() {
  const searchParams = useSearchParams()
  const pathname     = usePathname()
  const router       = useRouter()

  function setMonth(month: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', month)
    params.delete('page')   // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  return <Select onSelectionChange={k => setMonth(k as string)} ... />
}
```

Never mutate `searchParams` directly — always construct a new `URLSearchParams` from the current value.

---

## 10. Dynamic Route Segments

### Accessing `params` in server components

```tsx
// app/(app)/expenses/[id]/page.tsx
export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const expense = await fetchExpenseById(params.id, session.user.id)
  if (!expense) notFound()

  return <ExpenseDetail expense={expense} />
}
```

Always pass `session.user.id` alongside `params.id` when fetching — the service layer must confirm ownership. See `docs/auth.md` § 10.

### Generating static params (optional, for known IDs)

If expense detail pages should be statically generated at build time, export `generateStaticParams`. For a user-specific app this is generally not applicable — skip it unless the resource is public.

---

## 11. Redirects

### Application-level redirects (in `next.config.ts`)

Permanent and semi-permanent URL renames live here — not in route handlers.

```ts
// next.config.ts
const nextConfig = {
  async redirects() {
    return [
      {
        source:      '/home',
        destination: '/dashboard',
        permanent:   true,   // 308 — browsers cache this
      },
      {
        source:      '/settings',
        destination: '/settings/profile',
        permanent:   false,  // 307 — the target may change
      },
    ]
  },
}
```

### In-code redirects

Use `redirect()` from `next/navigation` in server components and Server Actions. Use `router.push()` in client components. Never use `window.location.href`.

---

## 12. Route Summary Table

| URL | Protected | Page file | API file |
|---|---|---|---|
| `/` | No | `app/(public)/page.tsx` | — |
| `/login` | No (redirect if authed) | `app/(auth)/login/page.tsx` | — |
| `/register` | No (redirect if authed) | `app/(auth)/register/page.tsx` | — |
| `/dashboard` | Yes | `app/(app)/dashboard/page.tsx` | — |
| `/expenses` | Yes | `app/(app)/expenses/page.tsx` | `app/api/expenses/route.ts` |
| `/expenses/[id]` | Yes | `app/(app)/expenses/[id]/page.tsx` | `app/api/expenses/[id]/route.ts` |
| `/expenses/[id]/edit` | Yes | `app/(app)/expenses/[id]/edit/page.tsx` | `app/api/expenses/[id]/route.ts` |
| `/categories` | Yes | `app/(app)/categories/page.tsx` | `app/api/categories/route.ts` |
| `/reports` | Yes | `app/(app)/reports/page.tsx` | `app/api/summary/route.ts` |
| `/settings` | Yes | `app/(app)/settings/page.tsx` (→ redirect) | — |
| `/settings/profile` | Yes | `app/(app)/settings/profile/page.tsx` | `app/api/user/route.ts` |
| `/settings/preferences` | Yes | `app/(app)/settings/preferences/page.tsx` | `app/api/user/route.ts` |
| `/api/auth/[...nextauth]` | No | — | `app/api/auth/[...nextauth]/route.ts` |
| `/api/expenses` | Yes | — | `app/api/expenses/route.ts` |
| `/api/expenses/[id]` | Yes | — | `app/api/expenses/[id]/route.ts` |
| `/api/categories` | Yes | — | `app/api/categories/route.ts` |
| `/api/categories/[id]` | Yes | — | `app/api/categories/[id]/route.ts` |
| `/api/summary` | Yes | — | `app/api/summary/route.ts` |
| `/api/user` | Yes | — | `app/api/user/route.ts` |
