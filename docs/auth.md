# Authentication & Authorisation Specification

**Stack:** NextAuth v4 (`next-auth@^4`) · Next.js 16 App Router · Supabase (PostgreSQL) · TypeScript

---

## 1. Core Principles

These rules are non-negotiable and must be enforced at every layer.

1. **Session is the source of truth.** The authenticated user's identity always comes from the server-side NextAuth session. A `user_id` value from a request body, query string, or cookie is never trusted — it is always ignored and overwritten with `session.user.id`.

2. **All app routes are protected by default.** Every route under `(app)/*` requires authentication. Public routes are an explicit allowlist, not the default.

3. **Defence in depth.** Identity is enforced at three independent layers — middleware, API/server logic, and the database (Supabase RLS). Bypassing one layer does not grant access.

4. **Users can only see and modify their own data.** No query, mutation, or response may include data belonging to a different user. This is enforced in the service layer and guaranteed by database policy.

---

## 2. Installation

```bash
npm install next-auth bcryptjs
npm install -D @types/bcryptjs
```

`next-auth` v4 is the current stable release. Do not install `next-auth@beta` or `@auth/nextjs` — those are pre-release packages for the forthcoming v5.

---

## 3. File Structure

```
/
├── middleware.ts                        # Edge route protection
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts            # NextAuth route handler
│   ├── (auth)/                         # Public auth UI routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   └── (app)/                          # All protected app routes
│       ├── layout.tsx                  # Server-side session guard
│       ├── dashboard/page.tsx
│       ├── expenses/page.tsx
│       ├── categories/page.tsx
│       ├── reports/page.tsx
│       └── settings/page.tsx
├── lib/
│   ├── auth/
│   │   ├── config.ts                   # authOptions — single source of truth
│   │   └── session.ts                  # requireSession() helper
│   └── services/
│       ├── expenseService.ts
│       └── summaryService.ts
└── types/
    └── next-auth.d.ts                  # Session + JWT type augmentation
```

---

## 4. NextAuth Configuration — `lib/auth/config.ts`

`authOptions` is the single source of truth for all authentication behaviour. It is passed to `NextAuth()`, `getServerSession()`, and `withAuth()` — it is never re-defined elsewhere.

```ts
// lib/auth/config.ts
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabaseClient'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, email, name, password_hash, provider')
          .eq('email', credentials.email)
          .single()

        if (!user || user.provider !== 'credentials' || !user.password_hash) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        // Return shape is mapped into the JWT by the jwt callback below
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async signIn({ user, account }) {
      // Auto-provision Google users on their first sign-in
      if (account?.provider === 'google') {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', user.email!)
          .single()

        if (!existing) {
          const { data: created } = await supabaseAdmin
            .from('users')
            .insert({
              email:         user.email!,
              name:          user.name ?? 'User',
              provider:      'google',
              password_hash: null,
            })
            .select('id')
            .single()

          // Attach the Supabase UUID so the jwt callback can persist it
          user.id = created!.id
        } else {
          user.id = existing.id
        }
      }
      return true
    },

    async jwt({ token, user }) {
      // On initial sign-in `user` is populated — persist the Supabase UUID as sub
      if (user?.id) {
        token.sub = user.id
      }
      return token
    },

    async session({ session, token }) {
      // Expose the Supabase UUID on session.user.id for use in server code
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',   // Error code passed as ?error= query param
  },
}
```

### Why JWT sessions

Database (adapter-based) sessions require a `sessions` table and an additional DB round-trip on every request. JWT sessions are stateless, verified at the edge via `NEXTAUTH_SECRET`, and sufficient for this app's trust model. The JWT is stored in an `httpOnly`, `Secure`, `SameSite=lax` cookie — it cannot be read or tampered with by client-side JavaScript.

---

## 5. Route Handler — `app/api/auth/[...nextauth]/route.ts`

```ts
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth/config'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

All OAuth callbacks, credential sign-in, sign-out, CSRF token, and session endpoints are handled automatically through this single file.

---

## 6. Session Type Augmentation — `types/next-auth.d.ts`

NextAuth's default `Session` type does not include `id`. This augmentation makes `session.user.id` a typed, non-optional `string` everywhere it is used, and aligns the `JWT` type with what the `jwt` callback writes.

```ts
// types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string
  }
}
```

---

## 7. Middleware — `middleware.ts`

The middleware runs at the edge before any route handler. It is the first line of defence. NextAuth v4 exposes `withAuth` for this purpose — it verifies the JWT and calls the `authorized` callback to decide whether to allow or redirect.

```ts
// middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const isAuth = !!req.nextauth.token

    // Redirect authenticated users away from auth pages
    const isAuthPage =
      pathname.startsWith('/login') || pathname.startsWith('/register')

    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl

        // Public paths — always allow
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/api/auth')
        ) {
          return true
        }

        // All other paths require a valid token
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
```

**What this guarantees:**
- Any unauthenticated request to any path not in the public allowlist is redirected to `/login`
- `withAuth` appends the original path as `callbackUrl` automatically
- Authenticated users hitting `/login` or `/register` are redirected to `/dashboard`
- `req.nextauth.token` is the decoded JWT — available inside the middleware function for any additional claims checks

---

## 8. Server-Side Session Helper — `lib/auth/session.ts`

`getServerSession` requires `authOptions` to be passed on every call. This helper centralises that call and throws a typed error if invoked without a valid session — preventing any accidental unauthenticated data access.

```ts
// lib/auth/session.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import type { Session } from 'next-auth'

export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error('UNAUTHENTICATED')
  }

  return session
}
```

Callers catch `UNAUTHENTICATED` and return `401`. In practice this should never trigger because middleware blocks unauthenticated requests first — it exists as a safety net for direct API calls that bypass the browser.

---

## 9. Protected Layout — `app/(app)/layout.tsx`

The `(app)` route group wraps every protected page. This server component is a second gate after middleware — it ensures pages never render for unauthenticated users even if middleware is misconfigured or bypassed.

```tsx
// app/(app)/layout.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <>{children}</>
}
```

---

## 10. Identity Enforcement in API Routes

### The rule

**Never read `user_id` from the request.** Always call `requireSession()` and use `session.user.id`. This eliminates broken object-level authorisation (BOLA) — the class of vulnerability where a user submits a different user's ID and receives or modifies that user's data.

### Correct pattern — API route

```ts
// app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { insertExpense, fetchExpensesByUser } from '@/lib/services/expenseService'
import type { InsertExpense } from '@/types/models'

export async function GET(_req: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const expenses = await fetchExpensesByUser(session.user.id)
    return NextResponse.json(expenses)
  } catch (err) {
    console.error('[GET /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { category_id, amount, description, notes, date, is_recurring } = body

    if (!category_id || amount === undefined || !description || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // user_id is ALWAYS sourced from the session — never from the request body
    const payload: InsertExpense = {
      user_id:      session.user.id,
      category_id,
      amount:       Number(amount),
      description,
      notes:        notes ?? null,
      date,
      is_recurring: is_recurring ?? false,
    }

    const expense = await insertExpense(payload)
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    console.error('[POST /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
```

### Correct pattern — server component page

```tsx
// app/(app)/expenses/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { fetchExpensesByUser } from '@/lib/services/expenseService'

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const expenses = await fetchExpensesByUser(session.user.id)

  return <ExpensesView expenses={expenses} />
}
```

### Correct pattern — client components

```tsx
'use client'
import { useSession, signIn, signOut } from 'next-auth/react'

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <Spinner />
  if (!session) return <Button onPress={() => signIn()}>Sign in</Button>

  return (
    <Dropdown>
      <DropdownTrigger>
        <Avatar name={session.user.name ?? ''} />
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem onPress={() => signOut({ callbackUrl: '/login' })}>
          Sign out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
```

Client components access the session via `useSession` — they never call `getServerSession`. `useSession` reads from the cookie set by NextAuth and requires `SessionProvider` in the layout (see section 11).

### Correct pattern — ownership check on mutations

Before mutating a resource, the query must scope to both `id` and `user_id`. This means a user cannot affect another user's record even if they know its UUID.

```ts
// lib/services/expenseService.ts
export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)      // ← ownership enforced in the query

  if (error) throw error
}
```

`userId` is always passed from `session.user.id` at the call site. Service functions must never derive their own `userId`.

---

## 11. SessionProvider — `app/layout.tsx`

`useSession` requires `SessionProvider` to be present in the React tree. Wrap the root layout's children with it. Because `SessionProvider` is a client component, the wrapper must be a separate file.

```tsx
// app/providers.tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

---

## 12. Database-Level Enforcement — Supabase RLS

Row Level Security is the final safety net. Even if application-level identity enforcement is bypassed, RLS ensures the database refuses cross-user data access at query time.

Run the following in the Supabase SQL editor after the schema has been created.

```sql
-- Enable RLS on all user-scoped tables
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;

-- ── expenses ────────────────────────────────────────────────
CREATE POLICY "users can select own expenses"
  ON expenses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own expenses"
  ON expenses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own expenses"
  ON expenses FOR DELETE
  USING (user_id = auth.uid());

-- ── categories ───────────────────────────────────────────────
-- Users see their own categories AND global defaults (user_id IS NULL)
CREATE POLICY "users can select own and default categories"
  ON categories FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own categories"
  ON categories FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own categories"
  ON categories FOR DELETE
  USING (user_id = auth.uid());

-- ── monthly_summaries ────────────────────────────────────────
CREATE POLICY "users can select own summaries"
  ON monthly_summaries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own summaries"
  ON monthly_summaries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own summaries"
  ON monthly_summaries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

> **Note on `supabaseAdmin`:** The service role key bypasses RLS by design. It must only be used server-side in `lib/services/*` after `requireSession()` has already verified the caller's identity. It must never be used in client components or exposed to the browser.

---

## 13. Auth Pages

### Login — `app/(auth)/login/page.tsx`

- Uses HeroUI `Card`, `Input`, `Button`, `Divider`, `Link` — see `docs/ui.md`
- Credentials form calls `signIn('credentials', { email, password, callbackUrl: '/dashboard' })` from `next-auth/react`
- Google button calls `signIn('google', { callbackUrl: '/dashboard' })`
- On auth failure NextAuth sets `?error=` in the query string — read it to display an inline error via the HeroUI `Input` `errorMessage` prop or a `Chip`
- No success toast — the redirect to `/dashboard` is the confirmation

### Register — `app/(auth)/register/page.tsx`

- Collects name, email, password, and confirm password
- Client-side validation via HeroUI field `errorMessage` prop: password minimum 8 characters, passwords match
- Submits to a Next.js Server Action that:
  1. Checks email uniqueness against the `users` table
  2. Hashes the password with `bcrypt` (minimum 12 rounds)
  3. Inserts the new row into `users`
  4. Calls `signIn('credentials', ...)` to create the session immediately
- On duplicate email: return a field-level error — not a generic message (prevents account enumeration)

### Password hashing

```ts
import bcrypt from 'bcryptjs'

// Registration — in a Server Action
const hash = await bcrypt.hash(plainTextPassword, 12)

// Login — inside authOptions.providers[Credentials].authorize
const valid = await bcrypt.compare(plainTextPassword, storedHash)
```

Never store, log, or transmit plain-text passwords at any point in the flow.

---

## 14. Environment Variables

All secrets must live in `.env.local` and must never be committed to version control.

```bash
# NextAuth v4
NEXTAUTH_SECRET=          # openssl rand -base64 32  — required in all environments
NEXTAUTH_URL=             # http://localhost:3000 in dev, full URL in production

# Google OAuth — from console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Supabase — from Settings > API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # Server-only. Never prefix with NEXT_PUBLIC_.
```

`NEXTAUTH_SECRET` signs and verifies the JWT. Generate it with:

```bash
openssl rand -base64 32
```

`NEXTAUTH_URL` must match the deployment URL exactly. On Vercel it can be omitted if `VERCEL_URL` is set, but it is safer to set it explicitly.

---

## 15. Security Properties

| Property | How it is enforced |
|---|---|
| Session integrity | JWT signed with `NEXTAUTH_SECRET`; stored in `httpOnly`, `Secure`, `SameSite=lax` cookie — unreadable by JS |
| CSRF protection | NextAuth v4 uses double-submit cookie pattern with a `csrfToken` on all `POST` sign-in/out requests |
| Route protection | `withAuth` middleware blocks unauthenticated requests at the edge before any handler runs |
| Identity spoofing | `user_id` is never read from client input; always sourced from `session.user.id` via `getServerSession` |
| Cross-user data access | Service functions always filter by `userId`; Supabase RLS enforces the same at the DB level |
| Password storage | bcrypt with 12 rounds — resistant to brute force even if the hash is leaked |
| Secret exposure | `SUPABASE_SERVICE_ROLE_KEY` and `NEXTAUTH_SECRET` are server-only; never prefixed `NEXT_PUBLIC_` |
| Token leakage | The JWT is never returned in API responses or written to logs |
| Client data scope | `useSession` exposes only `session.user.{ id, name, email, image }` — no hash or token fields |
| Admin DB scope | `supabaseAdmin` is only imported in `lib/services/*` and `lib/auth/config.ts` — never in client code |

---

## 16. Anti-Patterns — Never Do These

If a code review finds any of the following, treat it as a security defect.

```ts
// ✗ Reading user_id from the request — trivially spoofable
const userId = req.body.user_id
const userId = searchParams.get('user_id')

// ✗ Calling getServerSession without authOptions — returns null in v4
const session = await getServerSession()

// ✗ Skipping ownership scope on mutations
await supabaseAdmin.from('expenses').delete().eq('id', expenseId)
// Missing: .eq('user_id', session.user.id)

// ✗ Using supabaseAdmin in a client component
'use client'
import { supabaseAdmin } from '@/lib/supabaseClient' // leaks service role key to browser bundle

// ✗ Accessing session in a server component via useSession
import { useSession } from 'next-auth/react' // hooks are client-only; use getServerSession instead

// ✗ Returning session or token data in an API response
return NextResponse.json({ session, token })

// ✗ Logging secrets
console.log(process.env.NEXTAUTH_SECRET)
console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)
```

---

## 17. Authorisation Checklist

Before shipping any new route or feature, verify all of the following.

**API Routes**
- [ ] `requireSession()` is called before any logic runs
- [ ] `user_id` is sourced exclusively from `session.user.id`
- [ ] Mutations include `.eq('user_id', session.user.id)` in the Supabase query
- [ ] `401` is returned if the session check throws `UNAUTHENTICATED`
- [ ] No session data, tokens, or password hashes are included in the response

**Server Components / Pages**
- [ ] Page lives inside the `app/(app)/` route group
- [ ] `getServerSession(authOptions)` is called and `session.user.id` verified before fetching data
- [ ] `redirect('/login')` is called if the session is missing

**Client Components**
- [ ] Session data accessed via `useSession` from `next-auth/react` — not `getServerSession`
- [ ] No sensitive operations (DB queries, service calls) run client-side

**Service Functions**
- [ ] `userId` is a required parameter on every function that touches user-scoped tables
- [ ] Every query filters by `user_id` — no unscoped `SELECT *` on protected tables

**Database**
- [ ] RLS is enabled on every user-scoped table
- [ ] Policies exist for SELECT, INSERT, UPDATE, and DELETE where applicable
- [ ] `supabaseAdmin` is only used server-side after session verification
