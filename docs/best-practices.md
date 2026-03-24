# React & Next.js Best Practices

**Source:** Adapted from [Vercel Engineering — React Best Practices v1.0.0](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md)
**Stack:** Next.js 16.2.1 · App Router · React 19 · TypeScript 5 · Supabase

Rules are grouped by category and ordered by impact. Follow them in priority order when writing or reviewing code.

---

## 1. Eliminating Waterfalls — CRITICAL

Sequential `await` chains are the single largest performance bottleneck. Each one adds a full network round-trip to the critical path. Fix these first.

---

### 1.1 Defer `await` Until the Result Is Actually Needed

Move `await` into the branch that consumes it. If a code path exits early, do not pay the cost of the fetch it would have used.

```ts
// ✗ Fetches even when skipProcessing is true
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  if (skipProcessing) return { skipped: true }
  return processUserData(userData)
}

// ✓ Returns early before touching the network
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true }
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

**In this project:** Apply this inside API route handlers in `app/api/`. Validate request shape and call `requireSession()` first — if either fails, return immediately before any Supabase query runs.

---

### 1.2 Parallelise Fetches That Have Partial Dependencies

When operation B depends on operation A but operation C is independent of both, do not wait for A before starting C.

```ts
// ✗ Three sequential round trips
export async function GET() {
  const session = await requireSession()
  const config   = await fetchConfig()
  const expenses = await fetchExpensesByUser(session.user.id)
  return NextResponse.json({ expenses, config })
}

// ✓ config starts immediately; expenses starts as soon as session resolves
export async function GET() {
  const sessionPromise = requireSession()
  const configPromise  = fetchConfig()

  const session = await sessionPromise
  const [config, expenses] = await Promise.all([
    configPromise,
    fetchExpensesByUser(session.user.id),
  ])
  return NextResponse.json({ expenses, config })
}
```

**Impact:** 2–10× faster response time depending on individual query latency.

---

### 1.3 Use `Promise.all()` for Fully Independent Operations

When fetches share no dependencies at all, start them together and await the group.

```ts
// ✗ Three round trips in series
const user       = await fetchUser()
const categories = await fetchCategories()
const summary    = await fetchSummary()

// ✓ One round trip
const [user, categories, summary] = await Promise.all([
  fetchUser(),
  fetchCategories(),
  fetchSummary(),
])
```

---

### 1.4 Parallelise Server Component Fetches via Composition

React Server Components render their tree sequentially unless you structure them so sibling components can fetch in parallel.

```tsx
// ✗ Sidebar waits for Header to finish
export default async function Page() {
  const header = await fetchHeader()
  return (
    <div>
      <div>{header}</div>
      <Sidebar />        {/* blocked until header resolves */}
    </div>
  )
}

// ✓ Header and Sidebar fetch simultaneously
async function Header() {
  const data = await fetchHeader()
  return <div>{data}</div>
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}

export default function Page() {
  return (
    <div>
      <Header />   {/* fetches in parallel */}
      <Sidebar />  {/* fetches in parallel */}
    </div>
  )
}
```

---

### 1.5 Use Suspense Boundaries to Stream Non-Critical Data

Wrap slow data-dependent components in `<Suspense>` so the surrounding layout renders immediately while data fetches in the background.

```tsx
// ✗ Entire page waits for the slowest query
async function Page() {
  const summary = await fetchMonthlySummary()  // blocks everything
  return (
    <div>
      <Navbar />
      <Sidebar />
      <SummaryCard summary={summary} />
    </div>
  )
}

// ✓ Navbar and Sidebar appear instantly; SummaryCard streams in
export default function Page() {
  return (
    <div>
      <Navbar />
      <Sidebar />
      <Suspense fallback={<Skeleton />}>
        <SummaryCard />
      </Suspense>
    </div>
  )
}

async function SummaryCard() {
  const summary = await fetchMonthlySummary()
  return <Card>{summary.total_spent}</Card>
}
```

**When NOT to use Suspense:** data that affects layout dimensions, SEO-critical above-the-fold content, or queries so fast that the skeleton flash is worse than the wait.

---

## 2. Bundle Size — CRITICAL

Smaller initial bundles directly improve Time to Interactive and LCP, especially on mobile.

---

### 2.1 Avoid Barrel File Imports

Importing from a library's root barrel file loads its entire module graph. Import directly from the source path instead.

```ts
// ✗ Loads thousands of modules (~1 MB, adds 200–800 ms cold start)
import { Check, X, Menu } from 'lucide-react'

// ✓ Loads 3 modules (~2 KB)
import Check from 'lucide-react/dist/esm/icons/check'
import X     from 'lucide-react/dist/esm/icons/x'
import Menu  from 'lucide-react/dist/esm/icons/menu'
```

For libraries supported by Next.js's built-in optimiser, enable it in `next.config.ts` and keep the ergonomic import:

```ts
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroui/react'],
  },
}
```

**Affected libraries in this project:** `lucide-react`, `@heroui/react`, any `@radix-ui/*` package.

---

### 2.2 Lazy-Load Heavy Components with `next/dynamic`

Components not required for the initial render should be code-split and loaded on demand.

```tsx
// ✗ Included in the main bundle
import { MonthlyChart } from './monthly-chart'

// ✓ Loaded only when the Reports page is visited
import dynamic from 'next/dynamic'

const MonthlyChart = dynamic(
  () => import('./monthly-chart').then(m => m.MonthlyChart),
  { ssr: false }
)
```

Use `ssr: false` for components that rely on browser APIs (`window`, `localStorage`, charting libraries).

---

### 2.3 Defer Non-Critical Third-Party Scripts

Analytics, error tracking, and logging do not block user interaction. Load them after hydration.

```tsx
// ✗ Blocks the main bundle
import { Analytics } from '@vercel/analytics/react'

// ✓ Loads after hydration
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
```

For `<script>` tags, always use Next.js's `<Script>` component with `strategy="afterInteractive"` or `strategy="lazyOnload"` — never a bare `<script>` tag in `<head>`.

---

### 2.4 Preload Heavy Bundles on User Intent

Begin loading a large chunk when the user signals intent (hover, focus) rather than waiting for the click.

```tsx
function ReportsLink() {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monthly-chart')
    }
  }

  return (
    <a
      href="/reports"
      onMouseEnter={preload}
      onFocus={preload}
    >
      Reports
    </a>
  )
}
```

---

## 3. Server-Side Performance — HIGH

---

### 3.1 Authenticate Server Actions Like API Routes

Server Actions are public HTTP endpoints. Middleware and layout guards are not sufficient — every action must verify the session internally.

```ts
// ✗ No auth check — anyone can call this action
'use server'
export async function deleteExpense(expenseId: string) {
  await supabaseAdmin.from('expenses').delete().eq('id', expenseId)
}

// ✓ Session verified inside the action; user_id sourced from session
'use server'
import { requireSession } from '@/lib/auth/session'

export async function deleteExpense(expenseId: string) {
  const session = await requireSession()

  await supabaseAdmin
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', session.user.id)   // ownership enforced
}
```

See `docs/auth.md` for the full identity enforcement rules.

---

### 3.2 Pass Only the Fields a Client Component Needs

Everything passed across the Server/Client boundary is serialised into the HTML payload. Pass individual fields, not whole objects.

```tsx
// ✗ Serialises all 15 fields of Expense into the HTML
async function Page() {
  const expense = await fetchExpense(id)
  return <ExpenseRow expense={expense} />
}

// ✓ Serialises only the three fields the component uses
async function Page() {
  const expense = await fetchExpense(id)
  return (
    <ExpenseRow
      description={expense.description}
      amount={expense.amount}
      date={expense.date}
    />
  )
}
```

---

### 3.3 Deduplicate Per-Request Data Fetching with `React.cache()`

Wrap Supabase lookups in `React.cache()` so that multiple server components in the same request share a single DB call.

```ts
// lib/services/expenseService.ts
import { cache } from 'react'

export const fetchExpensesByUser = cache(async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return data ?? []
})
```

`React.cache()` deduplicates within a single request only. For cross-request caching of stable data (e.g. default categories), use an LRU cache:

```ts
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, Category[]>({ max: 100, ttl: 5 * 60 * 1000 })

export async function fetchDefaultCategories(): Promise<Category[]> {
  const cached = cache.get('default')
  if (cached) return cached

  const { data } = await supabaseAdmin
    .from('categories')
    .select('*')
    .is('user_id', null)
    .eq('is_default', true)

  cache.set('default', data ?? [])
  return data ?? []
}
```

**Do not pass inline objects as cache keys** — `React.cache()` uses `Object.is` equality, so two separate `{ userId }` objects will always miss. Pass primitive values.

---

### 3.4 Use `after()` for Non-Blocking Side Effects

Fire logging, analytics, or audit trail writes after the response is sent so they do not add latency.

```ts
// ✗ Client waits for the log write
export async function POST(req: NextRequest) {
  const expense = await insertExpense(payload)
  await logAuditEvent('expense.created', expense.id)  // blocks response
  return NextResponse.json(expense, { status: 201 })
}

// ✓ Response returns immediately; log runs in the background
import { after } from 'next/server'

export async function POST(req: NextRequest) {
  const expense = await insertExpense(payload)

  after(async () => {
    await logAuditEvent('expense.created', expense.id)
  })

  return NextResponse.json(expense, { status: 201 })
}
```

---

### 3.5 Hoist Static I/O to Module Level

Code at module scope runs once on import, not per request. Load static files (fonts for OG images, static config) outside functions.

```ts
// ✗ Reads the file on every request
export async function GET() {
  const font = await readFile('./fonts/inter.ttf')
  // generate OG image...
}

// ✓ Reads the file once when the module is first imported
const fontPromise = readFile('./fonts/inter.ttf')

export async function GET() {
  const font = await fontPromise
  // generate OG image...
}
```

---

## 4. Client-Side Data Fetching — MEDIUM

---

### 4.1 Use SWR for Automatic Deduplication and Caching

When fetching data inside client components, use `swr` instead of raw `useEffect` + `fetch`. Multiple components mounting with the same key share one request.

```tsx
// ✗ Each instance fetches independently
function ExpenseSummary() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('/api/summary').then(r => r.json()).then(setData)
  }, [])
}

// ✓ All instances share one in-flight request
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function ExpenseSummary() {
  const { data, error, isLoading } = useSWR('/api/summary', fetcher)
  if (isLoading) return <Skeleton />
  if (error) return <ErrorMessage />
  return <SummaryCard data={data} />
}
```

For data that never changes during a session (default categories, user profile):

```tsx
import { useSWRImmutable } from 'swr/immutable'

const { data: categories } = useSWRImmutable('/api/categories/defaults', fetcher)
```

---

### 4.2 Use Passive Event Listeners for Scroll and Touch

Always pass `{ passive: true }` to `touchstart`, `touchmove`, and `wheel` listeners. Without it the browser stalls scrolling while waiting to see if `preventDefault()` will be called.

```ts
// ✗ Delays scroll by up to 300 ms on mobile
window.addEventListener('touchstart', handler)

// ✓ Browser scrolls without waiting
window.addEventListener('touchstart', handler, { passive: true })
window.addEventListener('wheel', handler, { passive: true })
```

---

### 4.3 Version and Minimise `localStorage` Data

Always wrap storage calls in `try/catch` (they throw in private browsing and when quota is exceeded), prefix keys with a version, and store only the minimal fields needed.

```ts
const VERSION = 'v1'

function savePreferences(prefs: { theme: string; currency: string }) {
  try {
    localStorage.setItem(`prefs:${VERSION}`, JSON.stringify(prefs))
  } catch {}
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(`prefs:${VERSION}`)
    return raw ? (JSON.parse(raw) as { theme: string; currency: string }) : null
  } catch {
    return null
  }
}
```

Never store full API response objects. Store only the fields the UI reads.

---

## 5. Re-render Optimisation — MEDIUM

---

### 5.1 Compute Derived Values During Render, Not in Effects

If a value can be computed from existing state or props, compute it inline. An extra `useState` + `useEffect` pair is two extra renders for every change.

```tsx
// ✗ Three renders per keystroke (state update → effect → setState)
const [firstName, setFirstName] = useState('')
const [lastName,  setLastName]  = useState('')
const [fullName,  setFullName]  = useState('')

useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// ✓ One render per keystroke
const [firstName, setFirstName] = useState('')
const [lastName,  setLastName]  = useState('')
const fullName = `${firstName} ${lastName}`   // derived during render
```

---

### 5.2 Never Define Components Inside Other Components

A component defined inside another component gets a new identity on every render. React treats it as a different component type and fully remounts it, destroying all its state.

```tsx
// ✗ Avatar is a different type on every render — remounts every time
function ExpenseRow({ expense }: { expense: Expense }) {
  const Badge = () => (
    <span className="chip">{expense.category_id}</span>
  )
  return <div><Badge /></div>
}

// ✓ Defined at module scope — stable identity across renders
function CategoryBadge({ categoryId }: { categoryId: string }) {
  return <span className="chip">{categoryId}</span>
}

function ExpenseRow({ expense }: { expense: Expense }) {
  return <div><CategoryBadge categoryId={expense.category_id} /></div>
}
```

---

### 5.3 Use Functional `setState` When New State Depends on Previous State

Passing an updater function guarantees you always operate on the latest state, eliminates stale closure bugs, and removes the state variable from `useCallback` dependency arrays.

```tsx
// ✗ Stale closure — removeItem captures the initial items value
const removeItem = useCallback((id: string) => {
  setItems(items.filter(item => item.id !== id))
}, [])   // items never updates here

// ✓ Always operates on the latest state
const removeItem = useCallback((id: string) => {
  setItems(curr => curr.filter(item => item.id !== id))
}, [])   // no dependency needed
```

---

### 5.4 Use Lazy `useState` Initialisation for Expensive Computations

Pass an initialiser *function* to `useState` for anything that is expensive to compute. Without the function, the expression runs on every render even though only the first result is ever used.

```tsx
// ✗ JSON.parse runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem('settings') || '{}')
)

// ✓ Runs only on the initial render
const [settings, setSettings] = useState(() => {
  try {
    const raw = localStorage.getItem('settings')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
})
```

---

### 5.5 Move Default Non-Primitive Props to Module-Level Constants

Default function and object parameters create a new reference on every render, breaking `React.memo`.

```tsx
// ✗ New function identity every render — memo never bails out
const ExpenseRow = memo(function ExpenseRow({
  onDelete = () => {}
}: { onDelete?: () => void }) { ... })

// ✓ Stable reference — memo works correctly
const NOOP = () => {}

const ExpenseRow = memo(function ExpenseRow({
  onDelete = NOOP
}: { onDelete?: () => void }) { ... })
```

---

### 5.6 Narrow `useEffect` Dependencies to Primitives

Depending on an object re-runs the effect whenever the object reference changes, even if the relevant fields haven't changed.

```tsx
// ✗ Re-runs when any field on session changes
useEffect(() => {
  trackUser(session.user.id)
}, [session])

// ✓ Re-runs only when the ID changes
useEffect(() => {
  trackUser(session.user.id)
}, [session.user.id])
```

---

### 5.7 Put User-Triggered Logic in Event Handlers, Not Effects

An effect that responds to a state flag runs an extra render cycle and re-runs if unrelated dependencies change. Inline the logic directly in the handler.

```tsx
// ✗ Extra render cycle; re-runs if `theme` changes even without submission
const [submitted, setSubmitted] = useState(false)
useEffect(() => {
  if (submitted) post('/api/expenses')
}, [submitted])

// ✓ Runs exactly once, exactly when the user acts
function handleSubmit() {
  post('/api/expenses')
}
```

---

### 5.8 Split `useMemo` Calls at Dependency Boundaries

Combining two computations with different dependencies means changing either triggers both. Split them so each updates independently.

```tsx
// ✗ Changing sortOrder re-runs the filter unnecessarily
const sorted = useMemo(() => {
  const filtered = expenses.filter(e => e.category_id === categoryId)
  return filtered.toSorted((a, b) =>
    sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount
  )
}, [expenses, categoryId, sortOrder])

// ✓ Filter and sort are independent memos
const filtered = useMemo(
  () => expenses.filter(e => e.category_id === categoryId),
  [expenses, categoryId]
)

const sorted = useMemo(
  () => filtered.toSorted((a, b) =>
    sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount
  ),
  [filtered, sortOrder]
)
```

---

### 5.9 Use `useTransition` Instead of Manual Loading State

`useTransition` gives you a free `isPending` flag, handles concurrent interruption, and reduces state variables.

```tsx
// ✗ Manual loading state — 3 state variables, possible race conditions
const [isLoading, setIsLoading] = useState(false)
const [results,   setResults]   = useState([])

const handleSearch = async (q: string) => {
  setIsLoading(true)
  setResults(await fetchExpenses(q))
  setIsLoading(false)
}

// ✓ useTransition — 1 state variable, race-safe
const [results, setResults] = useState([])
const [isPending, startTransition] = useTransition()

const handleSearch = (q: string) => {
  startTransition(async () => {
    setResults(await fetchExpenses(q))
  })
}
```

---

### 5.10 Use `useDeferredValue` for Expensive Derived Renders

When a user input drives a slow computation, defer the value so the input stays responsive while the expensive render happens in the background.

```tsx
function ExpenseSearch({ expenses }: { expenses: Expense[] }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(
    () => expenses.filter(e =>
      e.description.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
    [expenses, deferredQuery]
  )

  const isStale = query !== deferredQuery

  return (
    <>
      <Input value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <ExpenseTable expenses={filtered} />
      </div>
    </>
  )
}
```

---

### 5.11 Use `useRef` for Values That Don't Drive the UI

If a value changes frequently but the UI doesn't need to re-render in response to it, store it in a ref and update the DOM directly.

```tsx
// ✗ Re-renders on every scroll event
const [scrollY, setScrollY] = useState(0)
useEffect(() => {
  window.addEventListener('scroll', () => setScrollY(window.scrollY))
}, [])

// ✓ Zero re-renders; DOM updated imperatively
const headerRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  const handler = () => {
    if (headerRef.current) {
      headerRef.current.style.opacity = window.scrollY > 100 ? '0' : '1'
    }
  }
  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
}, [])
```

---

## 6. Rendering Performance — MEDIUM

---

### 6.1 Apply `content-visibility: auto` to Long Lists

Off-screen items in long lists skip layout and paint until they scroll into view, dramatically improving initial render time.

```css
/* In your CSS module or global styles */
.expense-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 64px;   /* estimated row height */
}
```

With 500 expense rows, the browser skips layout and paint for ~490 off-screen items on initial load.

---

### 6.2 Prevent Hydration Mismatches with an Inline Script

For values that differ between server and client (theme from `localStorage`, user locale), inject a synchronous script instead of using `useEffect`, which causes a visible flash.

```tsx
// In app/(app)/layout.tsx or app/providers.tsx
function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){
          try {
            var t = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e){}
        })();`,
      }}
    />
  )
}
```

The script runs before React hydrates, so the first paint matches the hydrated state. No flicker.

---

### 6.3 Use Ternaries for Conditional Rendering Involving Falsy Numbers

The `&&` short-circuit renders the falsy value itself when the left side is `0` or `NaN`.

```tsx
// ✗ Renders "0" in the DOM when count is zero
{count && <Badge>{count}</Badge>}

// ✓ Renders nothing when count is zero
{count > 0 ? <Badge>{count}</Badge> : null}
```

**Common in this project:** expense counts, category totals, remaining budget.

---

### 6.4 Use `defer` / `async` on All Script Tags via Next.js `<Script>`

Never include a bare `<script src="...">` tag. Use Next.js's `<Script>` component with the appropriate strategy.

```tsx
import Script from 'next/script'

// Loads after page becomes interactive
<Script src="https://example.com/widget.js" strategy="afterInteractive" />

// Loads during browser idle time
<Script src="https://example.com/analytics.js" strategy="lazyOnload" />
```

---

### 6.5 Use React DOM Resource Hints for Critical Assets

Call `prefetchDNS`, `preconnect`, and `preload` directly from server components to push `<link>` hints into the `<head>` without a custom Document.

```tsx
import { prefetchDNS, preconnect, preload } from 'react-dom'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Preconnect to Supabase so the first API call is faster
  preconnect('https://qbluvdpykjyfcpvsnfep.supabase.co')
  prefetchDNS('https://fonts.googleapis.com')
  preload('/fonts/geist.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })

  return <html><body>{children}</body></html>
}
```

---

### 6.6 Hoist Static JSX to Module Scope

Static JSX that never changes should live outside the component function so React reuses the same object reference every render instead of recreating it.

```tsx
// ✗ New object on every render
function ExpenseTable() {
  return (
    <div>
      {isLoading && <div className="animate-pulse h-16 rounded-lg bg-default-200" />}
    </div>
  )
}

// ✓ Same object reference every render
const loadingSkeleton = (
  <div className="animate-pulse h-16 rounded-lg bg-default-200" />
)

function ExpenseTable() {
  return <div>{isLoading && loadingSkeleton}</div>
}
```

---

## 7. JavaScript Performance — LOW–MEDIUM

Apply these in hot paths — list rendering, filter/sort operations, event handlers.

---

### 7.1 Use `toSorted()` and `toReversed()` — Never Mutate Arrays

`.sort()` and `.reverse()` mutate the original array, which breaks React's change detection and causes subtle bugs. Use the immutable variants.

```ts
// ✗ Mutates the prop — breaks React's diffing
const sorted = expenses.sort((a, b) => a.amount - b.amount)

// ✓ Returns a new array
const sorted = expenses.toSorted((a, b) => a.amount - b.amount)
```

---

### 7.2 Build Index Maps Instead of Repeated `.find()` Calls

`.find()` on an array is O(n). If you call it inside a `.map()`, the total cost is O(n²). Build a `Map` first.

```ts
// ✗ O(n²) — find scans the whole categories array for every expense
const rows = expenses.map(e => ({
  ...e,
  category: categories.find(c => c.id === e.category_id),
}))

// ✓ O(n) — single pass to build the index, O(1) lookups
const categoryById = new Map(categories.map(c => [c.id, c]))

const rows = expenses.map(e => ({
  ...e,
  category: categoryById.get(e.category_id),
}))
```

---

### 7.3 Use `Set` for Membership Checks

`.includes()` on an array is O(n). `Set.has()` is O(1).

```ts
// ✗ O(n) per check
const selectedIds = ['id-1', 'id-2', 'id-3']
const isSelected = selectedIds.includes(expense.id)

// ✓ O(1) per check
const selectedIds = new Set(['id-1', 'id-2', 'id-3'])
const isSelected = selectedIds.has(expense.id)
```

---

### 7.4 Use `.flatMap()` to Map and Filter in One Pass

`.map().filter()` creates an intermediate array and iterates twice. `.flatMap()` does it in one pass.

```ts
// ✗ Two iterations, one intermediate array
const activeNames = expenses
  .map(e => e.is_recurring ? e.description : null)
  .filter(Boolean)

// ✓ One iteration
const activeNames = expenses.flatMap(e =>
  e.is_recurring ? [e.description] : []
)
```

---

### 7.5 Early Return from Validation and Search Functions

Return as soon as the outcome is known. Do not process remaining items after the result is determined.

```ts
// ✗ Continues looping after finding the first error
function validateExpenses(expenses: InsertExpense[]) {
  let error = ''
  for (const e of expenses) {
    if (!e.description) error = 'Description required'
    if (e.amount < 0)   error = 'Amount must be positive'
  }
  return error
}

// ✓ Returns immediately on the first error
function validateExpenses(expenses: InsertExpense[]) {
  for (const e of expenses) {
    if (!e.description) return 'Description required'
    if (e.amount < 0)   return 'Amount must be positive'
  }
  return null
}
```

---

### 7.6 Hoist `RegExp` Creation Outside Render

Creating a `RegExp` inside a component function allocates a new object every render. Define it at module scope or memoize it.

```tsx
// ✗ New RegExp on every render
function SearchHighlight({ text, query }: Props) {
  const regex = new RegExp(`(${query})`, 'gi')
  ...
}

// ✓ Memoized — new regex only when query changes
function SearchHighlight({ text, query }: Props) {
  const regex = useMemo(
    () => new RegExp(`(${escapeRegex(query)})`, 'gi'),
    [query]
  )
  ...
}
```

---

### 7.7 Find Min/Max with a Single Loop, Not `.sort()`

Sorting just to get the first or last element is O(n log n) when a single loop is O(n).

```ts
// ✗ Sorts entire array just for the maximum
const maxExpense = expenses.toSorted((a, b) => b.amount - a.amount)[0]

// ✓ Single pass
function findMaxExpense(expenses: Expense[]): Expense | null {
  if (!expenses.length) return null
  let max = expenses[0]
  for (let i = 1; i < expenses.length; i++) {
    if (expenses[i].amount > max.amount) max = expenses[i]
  }
  return max
}
```

---

## 8. Advanced Patterns — LOW

---

### 8.1 Guard One-Time Initialisation Against StrictMode Remounts

React StrictMode (and future concurrent features) may remount components, causing `useEffect` with an empty dependency array to run twice in development. Use a module-level flag for truly one-time initialisation.

```ts
// ✗ Runs twice in StrictMode dev
useEffect(() => {
  initAnalytics()
  hydrateLocalStorageCache()
}, [])

// ✓ Runs once regardless of remounts
let didInit = false

useEffect(() => {
  if (didInit) return
  didInit = true
  initAnalytics()
  hydrateLocalStorageCache()
}, [])
```

---

### 8.2 Use `useEffectEvent` for Stable Event Subscriptions

When an effect sets up a subscription and needs to call a callback that changes over time, `useEffectEvent` creates a stable function reference that always invokes the latest version — without adding the callback to the dependency array.

```tsx
// ✗ Re-subscribes to the event every time onExpenseChange changes
useEffect(() => {
  channel.on('expense.created', onExpenseChange)
  return () => channel.off('expense.created', onExpenseChange)
}, [onExpenseChange])

// ✓ Subscribes once; always calls the latest onExpenseChange
import { useEffectEvent } from 'react'

const onEvent = useEffectEvent(onExpenseChange)

useEffect(() => {
  channel.on('expense.created', onEvent)
  return () => channel.off('expense.created', onEvent)
}, [])
```

---

## Quick Reference

| Category | Rule | Impact |
|---|---|---|
| Waterfalls | Defer `await` past early returns | HIGH |
| Waterfalls | Start independent promises immediately | CRITICAL |
| Waterfalls | `Promise.all()` for independent fetches | CRITICAL |
| Waterfalls | Composition to parallelise RSC fetches | CRITICAL |
| Waterfalls | `<Suspense>` for non-critical data | HIGH |
| Bundle | Direct imports, not barrel files | CRITICAL |
| Bundle | `next/dynamic` for heavy components | CRITICAL |
| Bundle | Defer third-party scripts | MEDIUM |
| Bundle | Preload on user intent | MEDIUM |
| Server | Auth check inside every Server Action | CRITICAL |
| Server | Minimal props across RSC boundary | HIGH |
| Server | `React.cache()` per-request dedup | MEDIUM |
| Server | `after()` for non-blocking side effects | MEDIUM |
| Client | SWR for deduplication | MEDIUM |
| Client | Passive scroll/touch listeners | MEDIUM |
| Client | Version + minimise `localStorage` | MEDIUM |
| Re-renders | Derived state inline, not in effects | MEDIUM |
| Re-renders | Never define components inside components | HIGH |
| Re-renders | Functional `setState` updates | MEDIUM |
| Re-renders | Lazy `useState` initialisation | MEDIUM |
| Re-renders | `useTransition` over manual loading state | MEDIUM |
| Re-renders | `useDeferredValue` for expensive filters | MEDIUM |
| Rendering | `content-visibility: auto` on long lists | HIGH |
| Rendering | Ternary over `&&` for falsy numbers | LOW |
| JS | `toSorted()` — never mutate arrays | MEDIUM |
| JS | Index `Map` over repeated `.find()` | MEDIUM |
| JS | `Set` for membership checks | LOW |
| JS | `flatMap` over `.map().filter()` | LOW |
| JS | Early return from loops | LOW |
