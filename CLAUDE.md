# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
