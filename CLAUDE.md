# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Workflow — Mandatory

Every task in this project follows the process defined in `docs/ai-workflow.md`. Read it before doing anything else.

**The short version:**
1. Read all relevant `/docs` files
2. Propose a written plan (summary, files to create/modify, architecture decisions, auth ownership, out of scope)
3. Wait for explicit approval
4. Only then write code

No code is written before a plan is approved. No exceptions.

---

## Documentation-First Rule

Before forming any plan, you **must** read every relevant file in the `/docs` directory. Do not write code that contradicts or ignores these documents.

| Doc file | When to read it |
|---|---|
| `docs/ai-workflow.md` | Before every task — defines the mandatory planning workflow |
| `docs/ui.md` | Before touching any UI — components, layouts, pages, modals, states |
| `docs/auth.md` | Before touching any auth flow, route protection, session handling, or data access |
| `docs/best-practices.md` | Before writing any React or Next.js code — components, hooks, data fetching, API routes |
| `docs/routing.md` | Before adding, moving, or renaming any route, page, layout, or API handler |
| `docs/errors-and-validation.md` | Before writing any form, API route, Server Action, or error boundary |
| `docs/security.md` | Before any work involving env vars, secrets, API keys, or data handling |
| `docs/data-mutation.md` | Before writing any Server Action, form submission handler, or data write operation |
| `docs/data-fetching.md` | Before writing any Server Component, page, or layout that reads data from the database |

Enforcement rules:
- **UI work:** Every component must use only the HeroUI components listed in `docs/ui.md`. No custom CSS, no custom primitives, no inline styles. If a design decision is not covered by `docs/ui.md`, ask before inventing something.
- **New docs:** If a new file is added to `/docs`, treat it as mandatory reading for its domain from that point forward.
- **Conflicts:** If a user request conflicts with a `/docs` specification, flag the conflict explicitly before writing any code.

---

## Important: Next.js Version Warning

This project uses **Next.js 16.2.1** with **React 19.2.4**. This version has breaking changes — APIs, conventions, and file structure may differ from training data. Before writing any code, read the relevant guide in `node_modules/next/dist/docs/`. Heed all deprecation notices.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework is configured.

## Stack

- **Framework:** Next.js 16.2.1 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 with PostCSS (uses `@theme` directive and CSS variables, not `tailwind.config.js`)
- **Fonts:** Geist Sans / Geist Mono via Next.js font optimization

## Architecture

This is a fresh scaffold — only the boilerplate `app/` directory exists with no business logic yet. The App Router lives under `app/`:

- `layout.tsx` — root layout, font setup, global metadata
- `page.tsx` — home page (currently template content)
- `globals.css` — Tailwind import + CSS custom properties for light/dark theming

Path alias `@/*` resolves to the project root.
