# Security Specification

**Stack:** Next.js 16.2.1 App Router · Supabase · NextAuth v4 · TypeScript · Vercel

---

## 1. Core Rules

These are absolute. No business justification overrides them.

1. **Secrets are never hardcoded.** No API key, token, password, connection string, or credential of any kind is written directly in source code — not in route files, not in scripts, not in config files, not in comments, not in test fixtures.

2. **`.env.local` is never committed to version control.** It exists only on local machines and is already covered by `.gitignore`. This is not optional.

3. **Server-only secrets never reach the client bundle.** Variables that are not prefixed with `NEXT_PUBLIC_` are stripped from client code by Next.js at build time. Variables that _are_ prefixed with `NEXT_PUBLIC_` are embedded in the JavaScript bundle and visible to anyone who visits the site. This distinction is the most important security line in a Next.js application.

4. **Secrets are never logged.** No `console.log`, `console.error`, or any logging call ever outputs a secret, token, session object, or any value sourced from an environment variable.

5. **A compromised secret is rotated immediately.** If a secret is ever exposed — in a commit, a log, a chat, a screenshot — it is treated as fully compromised and rotated before any other action is taken.

---

## 2. Secrets Inventory

Every secret used by this project, its classification, and where it must and must not appear.

| Variable | Classification | In browser bundle | In server code | In `.env.local` | In Vercel |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✓ allowed | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✓ allowed | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | **Critical secret** | ✗ never | ✓ | ✓ | ✓ |
| `NEXTAUTH_SECRET` | **Critical secret** | ✗ never | ✓ | ✓ | ✓ |
| `NEXTAUTH_URL` | Non-sensitive | ✗ | ✓ | ✓ | ✓ |
| `GOOGLE_CLIENT_ID` | Semi-public | ✗ | ✓ | ✓ | ✓ |
| `GOOGLE_CLIENT_SECRET` | **Secret** | ✗ never | ✓ | ✓ | ✓ |

### Why `SUPABASE_SERVICE_ROLE_KEY` is the highest-risk secret

The service role key bypasses Supabase Row Level Security entirely. Anyone who obtains it has unrestricted read and write access to every row in every table in the database — including all users' expense data, password hashes, and personal information. If this key is ever exposed, rotate it immediately via the Supabase dashboard and assume all data has been read.

### Why `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose

The anon key is intentionally public. It is the Supabase equivalent of a publishable API key — it identifies the project but grants no access beyond what Supabase Row Level Security allows. With RLS enabled (as specified in `docs/auth.md` § 12), the anon key alone cannot read any user's data. It is safe to embed in the browser bundle.

---

## 3. Environment Variable Files

Next.js loads environment variables from files in this priority order (highest to lowest):

```
.env.local          # Local overrides — gitignored, never committed
.env.development    # Development defaults — can be committed if no secrets
.env.production     # Production defaults — can be committed if no secrets
.env                # Shared fallback — can be committed if no secrets
```

**Rule:** Any file that contains a real secret must be in `.gitignore`. Only `.env.local` is used for secrets in this project. All other `.env.*` files must contain only non-sensitive defaults or be empty.

### 3.1 `.env.local` — local development only

This file lives on each developer's machine. It is never committed. Its contents should never be pasted into a chat, email, issue tracker, or document.

Required contents:

```bash
# Supabase — https://supabase.com/dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<random-32-byte-string>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth — https://console.cloud.google.com
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
```

### 3.2 `.env.example` — committed, values stripped

A checked-in template showing every required variable with placeholder values. New developers copy this to `.env.local` and fill in real values. It must never contain real values.

```bash
# .env.example — copy to .env.local and fill in real values
# NEVER put real secrets in this file

# Supabase — https://supabase.com/dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Google OAuth — https://console.cloud.google.com → Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Create `.env.example` at the project root and commit it. This is the only environment-related file that is ever committed.

---

## 4. `.gitignore` — Confirmed Coverage

The project's `.gitignore` already includes:

```
.env*
```

This glob pattern ignores every `.env` file regardless of suffix: `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.test`. This is correct and must not be changed.

### Additional entries to verify are present

```gitignore
# These must also be present in .gitignore
*.pem           # SSL certificates and private keys — already present
.vercel         # Vercel project config (can contain tokens) — already present
```

### What a `.gitignore` entry does NOT do

A `.gitignore` entry prevents future commits of a file. It does **not** remove the file from git history if the file was committed in the past. If a secret has ever been committed — even once, even if the commit was later "deleted" — treat it as fully public and rotate it. Git history is permanent and can be cloned by anyone with access to the repository.

---

## 5. The `NEXT_PUBLIC_` Prefix — Understanding the Boundary

Next.js uses the `NEXT_PUBLIC_` prefix to decide what enters the browser bundle at build time.

```
NEXT_PUBLIC_SUPABASE_URL          → embedded in JS bundle → visible to all users
NEXT_PUBLIC_SUPABASE_ANON_KEY     → embedded in JS bundle → visible to all users

SUPABASE_SERVICE_ROLE_KEY         → stripped from bundle  → server only
NEXTAUTH_SECRET                   → stripped from bundle  → server only
GOOGLE_CLIENT_SECRET              → stripped from bundle  → server only
```

This stripping happens at **build time**, not at runtime. A variable without `NEXT_PUBLIC_` evaluates to `undefined` in client-side code — it is not hidden or encrypted, it simply does not exist in the bundle.

### What this means in practice

```ts
// ✓ Safe — anon key is public by design, NEXT_PUBLIC_ is correct
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ✗ Catastrophic — service role key would be embedded in the browser bundle
// and exposed to every visitor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!  // NEVER add NEXT_PUBLIC_ to this
)

// ✓ Safe — server-only variable used only in server code
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!              // no NEXT_PUBLIC_ prefix
)
```

### Naming rule

Never add the `NEXT_PUBLIC_` prefix to any variable that contains a secret. If you are unsure whether a value is a secret, do not add the prefix.

---

## 6. Enforcing Server-Only Modules

The `server-only` package causes a build-time error if a module marked as server-only is imported into a Client Component. Install it and add it to any file that imports secrets or the `supabaseAdmin` client.

```bash
npm install server-only
```

```ts
// lib/supabaseClient.ts
import 'server-only'   // build fails if this is imported in a Client Component

import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

```ts
// lib/auth/session.ts
import 'server-only'

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth/config'
// ...
```

```ts
// lib/auth/config.ts
import 'server-only'
// ...
```

If a developer accidentally writes `import { supabaseAdmin } from '@/lib/supabaseClient'` in a `'use client'` component, the build will fail with a clear error before the code can be deployed.

---

## 7. Hardcoding — Explicit Violations

The following patterns are security violations. Every one of these has resulted in real credential leaks in production applications.

```ts
// ✗ Hardcoded API key in source code
const supabase = createClient(
  'https://qbluvdpykjyfcpvsnfep.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'   // real key in code
)

// ✗ Hardcoded secret in a utility script
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const db = createClient(URL, SERVICE_KEY)

// ✗ Hardcoded credentials in a test file
const TEST_USER = { email: 'test@example.com', password: 'TestPassword123!' }

// ✗ Secret in a comment
// TODO: replace this key 'eyJhbGci...' with an env var

// ✗ Secret committed through a config file
// firebase.json, .npmrc, config.json, appsettings.json, etc.

// ✗ NEXT_PUBLIC_ applied to a secret
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**Existing violation in this project — `scripts/seed.mjs`:**

The seed script currently hardcodes the Supabase URL and service role key directly in the file. This is a security violation. Before committing the script to version control it must be updated to read from environment variables:

```js
// ✗ Current — hardcoded credentials in scripts/seed.mjs
const SUPABASE_URL      = 'https://qbluvdpykjyfcpvsnfep.supabase.co'
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// ✓ Correct — read from environment at runtime
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables. Copy .env.example to .env.local.')
  process.exit(1)
}
```

---

## 8. Logging Rules

Logs are often more accessible than application code — they flow to third-party services, are stored long-term, and are frequently shared when debugging. A secret in a log is effectively a public secret.

### What must never appear in a log

```ts
// ✗ Environment variable values
console.log('Connected to Supabase:', process.env.SUPABASE_SERVICE_ROLE_KEY)

// ✗ Session objects (contain user tokens and IDs)
console.log('Session:', session)
console.error('Auth failed. Session was:', session)

// ✗ Request bodies (may contain passwords, financial data, PII)
console.log('Request body:', await req.json())

// ✗ Full error objects from Supabase (may contain query details and connection strings)
console.error('Supabase error:', supabaseError)

// ✗ Password or credential fields from any object
console.log('User:', { ...user, passwordHash })

// ✗ Authorization headers
console.log('Headers:', req.headers)
```

### What is safe to log

```ts
// ✓ Route and operation context
console.error('[POST /api/expenses] Failed to insert expense:', err.message)

// ✓ Non-sensitive identifiers (UUIDs are safe — they are not secrets)
console.error(`[expenseService.delete] No row found for id=${expenseId}`)

// ✓ Error message only (not the full error object or its stack)
console.error('[GET /api/summary] Supabase query failed:', err.message)

// ✓ Structured log with safe fields only
console.error({
  handler: 'POST /api/expenses',
  userId:  session.user.id,   // UUID, not a secret
  error:   err.message,       // message only, no stack
})
```

### Log format

Every server error log must follow this format so it is searchable and unambiguous:

```
[HANDLER] Description: error message
```

```ts
console.error('[POST /api/expenses] Failed to insert:', err.message)
console.error('[GET /api/categories] Supabase returned error:', err.message)
console.error('[deleteExpense] Row not found for id:', expenseId)
```

---

## 9. Production Deployment — Vercel

In production, secrets are injected at build and runtime as Vercel Environment Variables. They are never stored in files that are deployed.

### Setting environment variables on Vercel

1. Open the Vercel dashboard → your project → **Settings → Environment Variables**
2. Add each variable from the secrets inventory (section 2) with its production value
3. Set the **Environment** scope correctly:
   - `NEXTAUTH_URL` → Production only (value is the live domain)
   - All others → Production, Preview, and Development as appropriate
4. Click **Save** — Vercel re-encrypts and stores them, they are never shown in plaintext again after saving

### Vercel environment variable scopes

| Scope | When used |
|---|---|
| **Production** | Deployments from the main/production branch |
| **Preview** | Pull request and branch preview deployments |
| **Development** | `vercel dev` local development (not the same as `.env.local`) |

Use separate Supabase projects for production and preview/staging so preview deployments never touch production data. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the staging project values under the **Preview** scope.

### What never goes to Vercel

- `.env.local` files — Vercel environment variables replace this entirely in deployed environments
- The contents of `.env.local` as deployment build arguments
- Secrets in `next.config.ts` `env` block — this embeds them in the build output

```ts
// ✗ Never use the env block for secrets — they end up in the build artifact
const nextConfig = {
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,  // NEVER
  },
}
```

---

## 10. Preventing Accidental Exposure in the Next.js Build

Next.js performs static analysis at build time to detect environment variables. Be aware of two edge cases.

### Dynamic access bypasses stripping

```ts
// ✗ Dynamic access — Next.js cannot statically analyse this
// The variable may leak into the client bundle
const key = process.env[`SUPABASE_${type.toUpperCase()}_KEY`]

// ✓ Static access — Next.js strips server-only vars at build time
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
```

Always use static, literal string access for environment variables.

### `next.config.ts` `serverExternalPackages` and bundle analysis

Run `@next/bundle-analyzer` periodically to verify that server-only modules and their environment variable accesses are not leaking into client chunks:

```ts
// next.config.ts — enable bundle analysis
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer({
  // ...
})
```

```bash
ANALYZE=true npm run build
```

Inspect the client bundle map and verify no `supabaseAdmin`, `authOptions`, or service-role references appear.

---

## 11. Detecting Leaked Secrets in Git History

### Before pushing any commit

Use `git diff --cached` to review staged changes before committing. If any output contains a secret pattern, unstage the file and fix it.

```bash
# Review what is staged
git diff --cached

# If a secret is staged, unstage the file
git restore --staged .env.local
git restore --staged scripts/seed.mjs
```

### Scanning for leaked secrets

Install `gitleaks` to scan the entire repository history for secrets:

```bash
# One-time scan of all history
npx gitleaks detect --source . --log-opts="--all"

# Scan only staged changes before committing
npx gitleaks protect --staged
```

Configure it as a pre-commit hook so it runs automatically:

```bash
# .husky/pre-commit
npx gitleaks protect --staged --redact
```

### If a secret has already been committed

**Step 1 — Rotate the secret immediately.** Assume it is compromised. Do not wait.

- Supabase service role key: Dashboard → Settings → API → Regenerate
- `NEXTAUTH_SECRET`: Generate a new value (`openssl rand -base64 32`), deploy with the new value (all active sessions will be invalidated)
- Google OAuth secret: console.cloud.google.com → Credentials → Regenerate
- Supabase anon key: Dashboard → Settings → API → Regenerate (note: this will break any client-side Supabase calls until the new key is deployed)

**Step 2 — Remove from history.** Use `git filter-repo` (preferred over `git filter-branch`):

```bash
# Remove a specific file from all history
git filter-repo --path .env.local --invert-paths

# Replace a specific secret string in all history
git filter-repo --replace-text <(echo 'eyJhbGci...==>REDACTED')
```

**Step 3 — Force-push.** All collaborators must re-clone — their local copies still contain the secret.

**Step 4 — If the repository is public, assume the secret has been scraped.** GitHub, GitLab, and many third-party tools index public repositories in real time. Rotation is the only remedy.

---

## 12. Dependency Security

Third-party packages are a common vector for secret exposure and supply chain attacks.

### Audit on every install

```bash
npm audit
```

Run after every `npm install`. Fix `high` and `critical` severity vulnerabilities before merging.

### Review before installing

Before installing any new package:

1. Check the weekly download count and last publish date on npmjs.com
2. Verify the package name exactly — typosquatting (e.g. `next-auths` vs `next-auth`) is a known attack
3. Check for a public repository and recent maintenance activity
4. Do not install packages that request unusual permissions or perform postinstall scripts without a clear reason

### Lock file hygiene

- Always commit `package-lock.json`
- Never commit `node_modules/`
- Do not use `--no-save` or `--legacy-peer-deps` without understanding the implications
- Run `npm ci` in CI/CD pipelines — it installs exact lock file versions, not ranges

### Keeping dependencies updated

Review and update dependencies regularly. Outdated packages accumulate known vulnerabilities.

```bash
# Check for outdated packages
npm outdated

# Update within semver range
npm update

# Review major version bumps manually before applying
npx npm-check-updates
```

---

## 13. Security Headers

Add security headers to every response via `next.config.ts`. These prevent a class of browser-based attacks including clickjacking, MIME sniffing, and cross-site scripting.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',       value: 'on' },
  { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',       value: 'nosniff' },
  { key: 'Referrer-Policy',              value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',           value: 'camera=(), microphone=(), geolocation=()' },
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // tighten once inline scripts are removed
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' https://*.supabase.co`,
      "img-src 'self' data: https:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
```

---

## 14. Secret Rotation Policy

| Secret | Rotate when | How |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Immediately if compromised; every 90 days as routine | Supabase Dashboard → Settings → API → Regenerate |
| `NEXTAUTH_SECRET` | Immediately if compromised (invalidates all sessions) | `openssl rand -base64 32`, update Vercel env var, redeploy |
| `GOOGLE_CLIENT_SECRET` | Immediately if compromised | Google Cloud Console → Credentials → Regenerate |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | If Supabase project is compromised | Supabase Dashboard → API → Regenerate (update client-side code) |
| bcrypt password hashes | Never rotated directly — users reset their passwords | Trigger a forced password reset if the `users` table is compromised |

After rotating any secret:

1. Update Vercel environment variables for all scopes (Production, Preview)
2. Trigger a redeployment so the new value is picked up
3. Update `.env.local` on every developer machine
4. Confirm the old value no longer works

---

## 15. Incident Response

If a secret is suspected to be compromised, follow these steps in order without skipping.

```
1. ROTATE THE SECRET IMMEDIATELY
   Do this before anything else. Do not investigate first.
   A compromised secret that is still valid is an open door.

2. Check access logs
   Supabase: Dashboard → Logs → API logs
   Vercel:   Dashboard → Deployments → Functions logs
   Look for requests that should not have happened.

3. Remove from git history
   Use git filter-repo to scrub the secret from all commits.
   Force-push and require all collaborators to re-clone.

4. Audit what the secret had access to
   Service role key: full database access — check for unexpected reads/writes
   NEXTAUTH_SECRET: session forgery — check for unexpected authenticated actions
   Google secret: OAuth impersonation — check Google Cloud audit logs

5. Notify affected users if data was accessed
   If any user data was read or modified by an unauthorised party,
   users must be notified per applicable data protection regulations.

6. Update .env.example
   If a new secret was added during the incident, add a placeholder to .env.example.

7. Document the incident
   Record what happened, how the secret was exposed, and what was changed.
   Use this to improve prevention.
```

---

## 16. Security Checklist

Run through this before every pull request that touches environment variables, secrets, authentication, API routes, or deployment configuration.

**Environment variables**
- [ ] No secret is hardcoded anywhere in the diff
- [ ] New secrets are added to `.env.example` with placeholder values
- [ ] New secrets are added to Vercel environment variables for all relevant scopes
- [ ] Server-only secrets do not have the `NEXT_PUBLIC_` prefix
- [ ] `.env.local` is not staged (`git status` shows it as untracked or in `.gitignore`)

**Source code**
- [ ] No `console.log` or `console.error` outputs a secret, session, token, or request body
- [ ] `supabaseAdmin` is only imported in files that have `import 'server-only'`
- [ ] No environment variables are accessed dynamically (e.g. `process.env[key]`)
- [ ] No environment variable values appear in client-side code or the browser bundle

**Scripts and tooling**
- [ ] Any script that needs a secret reads it from `process.env`, not a hardcoded value
- [ ] `npm audit` reports no `high` or `critical` vulnerabilities
- [ ] Lock file (`package-lock.json`) is committed and up to date

**Deployment**
- [ ] Vercel environment variables are set for Production scope
- [ ] Preview deployments point to a non-production Supabase project
- [ ] Security headers are present in `next.config.ts`

**Auth and data**
- [ ] All points in the `docs/auth.md` checklist pass
- [ ] RLS is enabled on all user-scoped tables (see `docs/auth.md` § 12)
- [ ] No API response includes a stack trace, raw database error, or internal detail
