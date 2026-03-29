# Deployment Specification

**Stack:** Next.js 16.2.1 · Docker · GitHub Actions · Vercel · TypeScript

---

## 1. Overview

This project has two deployment flows, both driven by GitHub Actions and targeting Vercel.

| Trigger | Flow | Vercel target | Purpose |
|---|---|---|---|
| Pull request opened / updated | CI → Docker build → Vercel preview | Preview environment | Let developers test before merge |
| Push to `main` (after merge) | CI → Docker build → Vercel production | Production environment | Ship to real users |

Neither flow requires a developer to manually deploy. Every deployment is reproducible, auditable, and gated by the same CI checks.

---

## 2. Why Docker in a Vercel Deployment

Vercel can deploy Next.js directly without Docker. Docker is added here for three reasons:

1. **Build reproducibility.** The build runs in a fixed Node.js image version — not whatever version happens to be installed on the GitHub Actions runner or a developer's machine.
2. **Local parity.** Developers can run `docker build` locally to reproduce exactly what CI produces, eliminating "it works on my machine" failures.
3. **Portability.** If the project ever needs to move off Vercel (to Fly.io, Railway, AWS, etc.), the Docker image is already production-ready.

The Docker image is built and verified in CI. The actual serving in both preview and production environments is handled by Vercel, which receives the built output via the Vercel CLI.

---

## 3. File Structure

```
/
├── .github/
│   └── workflows/
│       ├── preview.yml      # PR → Vercel preview deployment
│       └── production.yml   # main push → Vercel production deployment
├── Dockerfile               # Multi-stage Next.js production image
├── .dockerignore            # Keeps the build context lean
├── .env.example             # Checked-in template — no real values
└── vercel.json              # Vercel project configuration
```

---

## 4. Dockerfile

Use a multi-stage build. The `builder` stage installs dependencies and compiles the Next.js app. The `runner` stage copies only the compiled output — no `node_modules`, no source files, no `.env` files.

```dockerfile
# Dockerfile

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first — Docker cache skips npm install
# on subsequent builds if these files have not changed
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy application source
COPY . .

# Build the Next.js app
# Environment variables are injected at runtime by Vercel — not at build time.
# NEXT_PUBLIC_ vars that must be inlined at build time are set via
# Vercel Environment Variables (see section 8).
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user — never run production processes as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only the compiled output from the builder stage
COPY --from=builder /app/public          ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static    ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

### Required `next.config.ts` setting

The standalone output mode must be enabled so Next.js emits a self-contained `server.js` that the Docker runner stage can execute directly.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // ... rest of config
}

export default nextConfig
```

### `.dockerignore`

Keep the build context lean. The fewer files sent to the Docker daemon, the faster the build.

```
node_modules
.next
.git
.env*
*.md
.github
coverage
```

The `.env*` glob ensures no local secret files can ever be accidentally copied into the image, even if a developer runs `docker build` locally.

---

## 5. GitHub Actions — Preview Flow (Pull Requests)

When a pull request is opened or updated against any branch, this workflow:

1. Checks out the code
2. Runs lint to catch errors early
3. Builds the Docker image to verify the build is healthy
4. Deploys to Vercel as a preview deployment
5. Posts the preview URL as a PR comment

```yaml
# .github/workflows/preview.yml

name: Preview Deployment

on:
  pull_request:
    branches: ['**']

concurrency:
  # Cancel any in-progress run for the same PR — avoids wasting runner minutes
  # on outdated commits when a developer pushes multiple times in quick succession
  group: preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  deploy-preview:
    name: Build & Deploy Preview
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write   # Required to post the preview URL comment

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build Docker image
        # Verify the image builds cleanly. The image is not pushed to a registry —
        # Vercel handles its own build. This step catches Dockerfile errors and
        # Next.js build failures before Vercel receives the deployment.
        run: |
          docker build \
            --tag expense-tracker:${{ github.sha }} \
            --label "git.sha=${{ github.sha }}" \
            --label "git.ref=${{ github.ref }}" \
            .

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel environment (preview)
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build for Vercel (preview)
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel (preview)
        id: deploy
        run: |
          url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "preview_url=$url" >> $GITHUB_OUTPUT

      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            const url = '${{ steps.deploy.outputs.preview_url }}';
            const sha  = context.sha.slice(0, 7);
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner:        context.repo.owner,
              repo:         context.repo.repo,
              body: `### Preview deployment\n\n**URL:** ${url}\n**Commit:** \`${sha}\`\n\nThis preview will be overwritten the next time a commit is pushed to this PR.`,
            });
```

### What the preview flow guarantees

- Lint must pass before a preview is deployed — broken code does not get a preview URL.
- Each PR gets its own isolated Vercel preview URL, scoped to preview environment variables (which point to the staging Supabase project — never production data).
- Concurrent pushes to the same PR cancel previous in-progress runs, saving runner minutes.
- The preview URL is posted directly to the PR — no manual hunting in the Vercel dashboard.

---

## 6. GitHub Actions — Production Flow (Main Branch)

When a pull request is merged into `main`, this workflow deploys to the Vercel production environment. It is intentionally stricter than the preview flow.

```yaml
# .github/workflows/production.yml

name: Production Deployment

on:
  push:
    branches:
      - main

concurrency:
  # Only one production deployment runs at a time.
  # New pushes to main queue behind the current deployment rather than
  # cancelling it — cancelling a half-completed production deploy is risky.
  group: production
  cancel-in-progress: false

jobs:
  deploy-production:
    name: Build & Deploy Production
    runs-on: ubuntu-latest
    environment: production   # Requires manual approval if configured in GitHub settings

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build Docker image
        run: |
          docker build \
            --tag expense-tracker:${{ github.sha }} \
            --label "git.sha=${{ github.sha }}" \
            --label "git.ref=${{ github.ref }}" \
            .

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel environment (production)
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build for Vercel (production)
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel (production)
        id: deploy
        run: |
          url=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
          echo "production_url=$url" >> $GITHUB_OUTPUT

      - name: Output deployment URL
        run: echo "Deployed to production ${{ steps.deploy.outputs.production_url }}"
```

### What the production flow guarantees

- Only commits on `main` trigger production deploys — feature branches can never deploy to production.
- The `concurrency: cancel-in-progress: false` setting queues deployments rather than cancelling a live deployment mid-flight.
- The `environment: production` block enables GitHub's environment protection rules (required reviewers, wait timer) if configured.
- Lint gates production the same way it gates previews — no exception for main.

---

## 7. Vercel Project Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options",         "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options",   "value": "nosniff" },
        { "key": "Referrer-Policy",          "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy",       "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

> **Note:** Security headers are also set in `next.config.ts` (see `docs/security.md` § 13). The `vercel.json` headers are an additional layer for responses that bypass the Next.js handler (static files, CDN-cached responses). Both are required.

---

## 8. Environment Variables

### Two Supabase projects, two sets of secrets

Preview and production deployments must never share a database. Use two separate Supabase projects — one for staging/preview, one for production.

| Variable | Production scope | Preview scope | Development scope |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production project URL | Staging project URL | Local or staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key | Staging anon key | Local or staging |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role | Staging service role | Local or staging |
| `NEXTAUTH_SECRET` | Unique production value | Unique preview value | Local value |
| `NEXTAUTH_URL` | `https://your-domain.com` | _(omit — Vercel sets `VERCEL_URL`)_ | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Production OAuth client | Can share or use separate | Same as preview |
| `GOOGLE_CLIENT_SECRET` | Production OAuth secret | Can share or use separate | Same as preview |

### Setting variables in Vercel

1. Open Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add each variable and select the correct **Environment** scope (Production / Preview / Development)
3. Click **Save** — Vercel encrypts the value at rest; it cannot be read back in plaintext
4. After adding or changing a variable, trigger a redeployment — running deployments use the values from the time they were built

### Setting secrets in GitHub Actions

The workflows use `secrets.VERCEL_TOKEN`. Add it once:

1. Generate a Vercel token: Vercel Dashboard → **Account Settings → Tokens → Create**
2. Add it to GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `VERCEL_TOKEN`, value: the token from step 1

The `VERCEL_TOKEN` must have permission to deploy to the project. It is used only in GitHub Actions — never hardcoded in any file.

Also set `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as repository secrets or repository variables. Obtain them from `.vercel/project.json` after running `vercel link` locally once.

```bash
# Run once locally to link the repo to the Vercel project
# This writes .vercel/project.json — add orgId and projectId to GitHub secrets
vercel link
```

```
# GitHub repository secrets to add:
VERCEL_TOKEN        ← Vercel personal access token
VERCEL_ORG_ID       ← from .vercel/project.json
VERCEL_PROJECT_ID   ← from .vercel/project.json
```

Add `.vercel/` to `.gitignore` — it may contain the token path and should not be committed.

---

## 9. Branch and Environment Mapping

```
feature/* ──── PR opened ────► GitHub Actions (preview.yml)
                                    │
                                    ├─ lint
                                    ├─ docker build (verify)
                                    └─ vercel deploy --preview
                                            │
                                            └─► Vercel Preview Environment
                                                (staging Supabase project)
                                                URL posted as PR comment

main ────────── PR merged ───► GitHub Actions (production.yml)
                                    │
                                    ├─ lint
                                    ├─ docker build (verify)
                                    └─ vercel deploy --prod
                                            │
                                            └─► Vercel Production Environment
                                                (production Supabase project)
                                                Live at your-domain.com
```

---

## 10. Reliability Practices

### Lint before deploy, always

Both workflows run `npm run lint` before deploying. A workflow that deploys broken code — even to preview — misleads reviewers. Lint is a fast check that catches obvious errors. It runs in under 30 seconds and has blocked real regressions.

### `npm ci` not `npm install`

Both the Dockerfile and the workflows use `npm ci`. Unlike `npm install`, `npm ci` installs exact versions from `package-lock.json`, fails if the lock file is out of sync, and never updates the lock file. This guarantees the same dependency versions in CI, Docker, and production.

### Pinned Action versions

All GitHub Actions are pinned to a specific commit SHA or major version tag (e.g. `@v4`). Unpinned actions (`@main`) can change without notice, introducing regressions or supply chain risk.

### Concurrency controls

- Preview: `cancel-in-progress: true` — only the latest commit on a PR gets a preview. Old in-progress runs are cancelled immediately, saving minutes.
- Production: `cancel-in-progress: false` — production deploys are never cancelled mid-flight. If two pushes land in quick succession, the second queues and waits.

### Non-root Docker user

The runner stage creates and switches to a non-root `nextjs` user. If the container process is ever compromised, the blast radius is limited to the application — the attacker does not have root on the host.

---

## 11. Security Practices

### Secrets never in source code

The `VERCEL_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, and all other secrets live exclusively in:
- Vercel Environment Variables (for deployed environments)
- GitHub Actions Secrets (for CI automation)
- `.env.local` on developer machines (gitignored)

They are never hardcoded in any file, including workflow YAML files, `next.config.ts`, `vercel.json`, or the Dockerfile. See `docs/security.md` for the full secrets inventory and handling rules.

### Preview deployments use staging data only

Preview environments are configured with the staging Supabase project credentials, not production. A broken migration or a destructive test in a preview environment cannot corrupt real user data.

### `NEXTAUTH_URL` on production

Set `NEXTAUTH_URL` explicitly to the production domain in Vercel's Production environment variables. NextAuth v4 uses this to construct callback URLs. If it is wrong or missing, OAuth redirects and sign-out flows will break. Vercel's auto-injected `VERCEL_URL` is not sufficient because it changes per deployment.

### Docker image never pushed to a public registry

The Docker image is built only to verify the build. It is not pushed to Docker Hub, GitHub Container Registry, or any other registry. The image contains no secrets — secrets are injected by Vercel at runtime — but it does contain compiled application code. Keep it private unless there is a specific reason to publish it.

### The `.vercel/` directory is gitignored

After running `vercel link`, a `.vercel/project.json` file is written locally. This file contains the `orgId` and `projectId`. These are not secret, but the directory may also cache tokens. Add it to `.gitignore` to prevent accidental commits.

```gitignore
# .gitignore — verify this is present
.vercel
```

---

## 12. Local Docker Verification

Developers can reproduce the CI Docker build locally to debug build failures before pushing.

```bash
# Build the image exactly as CI does
docker build --tag expense-tracker:local .

# Run the container locally
# Pass env vars explicitly — never bake them into the image
docker run \
  --rm \
  -p 3000:3000 \
  -e NEXTAUTH_SECRET=your-local-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e GOOGLE_CLIENT_ID=your-client-id \
  -e GOOGLE_CLIENT_SECRET=your-client-secret \
  expense-tracker:local
```

Open `http://localhost:3000` to verify the production build. This is the same image the CI build produces — if it works locally, it will work in preview.

**Never** use a `.env` file with `docker run --env-file` that contains production secrets. Use staging credentials for local Docker testing.

---

## 13. Deployment Checklist

Run through this before merging any change that touches deployment configuration, environment variables, or the Dockerfile.

**Dockerfile**
- [ ] Multi-stage build is used — `node_modules` and source files are not in the runner stage
- [ ] A non-root user is created and set as `USER` before `CMD`
- [ ] `.dockerignore` excludes `.env*`, `node_modules`, `.next`, and `.git`
- [ ] `next.config.ts` has `output: 'standalone'`

**GitHub Actions workflows**
- [ ] `npm ci` is used, not `npm install`
- [ ] Lint runs before the deploy step
- [ ] All action versions are pinned (e.g. `@v4`, not `@main`)
- [ ] `VERCEL_TOKEN` is read from `secrets.VERCEL_TOKEN`, not hardcoded
- [ ] Concurrency group is set correctly for preview (cancel) and production (queue)
- [ ] The production workflow targets `main` only

**Vercel environment variables**
- [ ] Production variables point to the production Supabase project
- [ ] Preview variables point to the staging Supabase project
- [ ] `NEXTAUTH_URL` is set correctly for Production scope
- [ ] No secret is present in `vercel.json` or any committed file

**After any secret rotation**
- [ ] Updated in Vercel Environment Variables for all relevant scopes
- [ ] Updated in `GitHub Actions Secrets` if applicable
- [ ] A redeployment is triggered so the new value takes effect
- [ ] The old value is confirmed to no longer work
