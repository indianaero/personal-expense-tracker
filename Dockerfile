# syntax=docker/dockerfile:1

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
# Install production and dev dependencies in a dedicated layer.
# Separating this from the build stage maximises Docker layer caching —
# node_modules is only reinstalled when package-lock.json changes.
FROM node:20-alpine AS deps

WORKDIR /app

# Install libc compatibility shim required by some native addons on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts


# ── Stage 2: builder ──────────────────────────────────────────────────────────
# Compile the Next.js application.
# next.config.ts must have `output: 'standalone'` — this stage produces
# .next/standalone, which is a self-contained Node.js server.
FROM node:20-alpine AS builder

WORKDIR /app

# Carry forward the installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# NEXT_PUBLIC_* variables that are inlined at build time must be provided here
# as build arguments if you ever need a custom value baked in.
# All other secrets (NEXTAUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, etc.) must
# NOT be passed as build arguments — Vercel injects them at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ── Stage 3: runner ───────────────────────────────────────────────────────────
# Minimal production image — contains only the compiled server output.
# No source files, no node_modules (standalone bundles only what is needed),
# no dev tooling, no build cache.
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root system user for the Node.js process.
# Running as root inside a container is a security risk even with namespacing.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy compiled output from the builder stage.
# The standalone directory contains a minimal node_modules subset bundled by
# Next.js — do not copy the full node_modules from the builder stage.
COPY --from=builder /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is emitted by Next.js standalone output.
# It reads PORT and HOSTNAME from the environment.
CMD ["node", "server.js"]
