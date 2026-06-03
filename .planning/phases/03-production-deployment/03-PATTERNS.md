# Phase 3: Production Deployment - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 6 existing files + 2 new files to create (railway.json / nixpacks.toml, .env.example)
**Analogs found:** 5 / 6 (no analog for railway.json — none exists in codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `railway.json` (new) | config | request-response | none in codebase | no analog |
| `.env.example` (exists, update) | config | n/a | `.env.example` (already exists) | exact |
| `package.json` (verify scripts) | config | n/a | `package.json` (existing) | exact |
| `prisma/schema.prisma` (verify datasource) | config | n/a | `prisma/schema.prisma` (existing) | exact |
| `app/lib/prisma.ts` (runtime reference) | utility | CRUD | `app/lib/prisma.ts` (existing) | exact |
| `app/api/chat/route.ts` (runtime reference) | route/controller | streaming | `app/api/chat/route.ts` (existing) | exact |

---

## Pattern Assignments

### `package.json` — build and start scripts

**Source:** `/home/court/dev/me/diet-app/package.json` lines 5–11

```json
"scripts": {
  "dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "next lint",
  "mcp": "bun mcp/server.ts"
}
```

**Deployment implications:**
- Railway build command: `npm run build` (runs `prisma generate` then `next build` — both required)
- Railway start command: `npm run start` (runs `next start`)
- `mcp` script uses `bun` — this is dev-only/local; Railway does NOT need to run it
- `NODE_OPTIONS='--dns-result-order=ipv4first'` is dev-only; not needed in production start command
- No `prisma migrate deploy` step exists or is needed — project uses `prisma db push` workflow

---

### `prisma/schema.prisma` — datasource and generator

**Source:** `/home/court/dev/me/diet-app/prisma/schema.prisma` lines 1–8

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

**Deployment implications:**
- `output = "../app/generated/prisma"` — Prisma generates client to `app/generated/prisma/`, NOT the default `node_modules/.prisma/client`. Railway build must run `prisma generate` before `next build` (already handled by `build` script).
- `datasource db` has **no `url` field** in schema — relies entirely on `DATABASE_URL` environment variable at runtime. Railway must have this env var set before the app starts.
- No migrations directory exists. No `prisma migrate deploy` command should be added to the start script.

---

### `app/lib/prisma.ts` — DATABASE_URL consumption pattern

**Source:** `/home/court/dev/me/diet-app/app/lib/prisma.ts` lines 1–13

```typescript
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Deployment implications:**
- Uses `@prisma/adapter-pg` driver adapter — not the default Prisma connection. `DATABASE_URL` is passed directly as `connectionString` to `PrismaPg`.
- `process.env.DATABASE_URL!` — hard assertion; app will crash at startup if this var is missing. Must be set in Railway environment variables before deploy.
- The global singleton guard (`globalForPrisma.prisma`) is correctly skipped in production (`NODE_ENV !== 'production'`), so each serverless invocation gets a fresh client in prod.
- Import path `@/app/generated/prisma/client` resolves via tsconfig path alias `"@/*": ["./*"]` from project root.

---

### `app/api/chat/route.ts` — OPENROUTER_API_KEY consumption pattern

**Source:** `/home/court/dev/me/diet-app/app/api/chat/route.ts` lines 1–7

```typescript
import OpenAI from 'openai';
import { logMeal, NoFoodItemsError } from '@/app/lib/food';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});
```

**Deployment implications:**
- `process.env.OPENROUTER_API_KEY!` — hard assertion; module initializes at startup. Missing var causes 500s on first chat POST, not a startup crash (module-level but lazy-imported by Next.js).
- Must be set as Railway environment variable before any chat requests are made.
- Also referenced identically in `app/lib/food.ts` line 7 — same pattern, same requirement.

---

### `app/lib/usda.ts` — USDA_API_KEY consumption pattern

**Source:** `/home/court/dev/me/diet-app/app/lib/usda.ts` line 197

```typescript
const apiKey = process.env.USDA_API_KEY ?? 'DEMO_KEY';
```

**Deployment implications:**
- Uses `?? 'DEMO_KEY'` fallback — NOT a hard assertion. App will start and function without this var.
- `DEMO_KEY` rate limit: 30 requests/hour. Acceptable for personal use but will throttle under real load.
- Setting `USDA_API_KEY` in Railway env vars gives 1,000 req/hr — recommended for production.

---

### `.env.example` — existing documented vars

**Source:** `/home/court/dev/me/diet-app/.env.example` lines 1–13

```
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
# Railway PostgreSQL connection string — find in Railway dashboard > project > variables

OPENROUTER_API_KEY="sk-or-..."
# OpenRouter API key from openrouter.ai/keys
# Required for LLM food parsing (google/gemini-2.0-flash-001) and confirmation messages
# Add to .env (gitignored) — never commit this value

USDA_API_KEY="DEMO_KEY"
# USDA FoodData Central API key from https://api.data.gov/signup/
# DEMO_KEY works for dev (30 req/hr); register for 1,000 req/hr
# Optional — DEMO_KEY is used as fallback in app/lib/usda.ts
```

**Deployment implications:**
- `.env.example` already exists and is complete for all 3 vars. Phase 3 SC4 ("create .env.example") is already satisfied — verify only, no write needed.
- `.env` itself is gitignored (standard Next.js scaffold behavior) — Railway env vars must be set via Railway dashboard, not committed files.

---

### `next.config.mjs` — no PORT or server binding

**Source:** `/home/court/dev/me/diet-app/next.config.mjs` lines 1–4

```javascript
const nextConfig = {};
export default nextConfig;
```

**Deployment implications:**
- No custom PORT binding, no custom server, no `output: 'standalone'` mode.
- Next.js respects `PORT` env var natively — Railway injects `PORT` automatically. No config change needed.
- No `output: 'standalone'` means Railway deploys the standard Next.js server (not a standalone binary). This is correct for Railway nixpacks — nixpacks handles the Node runtime.

---

### `tsconfig.json` — path alias affects Prisma import

**Source:** `/home/court/dev/me/diet-app/tsconfig.json` lines 20–25

```json
"paths": {
  "@/*": ["./*"]
},
"exclude": ["node_modules", "mcp"]
```

**Deployment implications:**
- `@/*` maps to project root, so `@/app/generated/prisma/client` resolves to `./app/generated/prisma/client`. This directory is generated by `prisma generate` at build time — if build step skips `prisma generate`, the import fails with a module-not-found error.
- `mcp` is excluded from Next.js TypeScript compilation — correct. The `mcp/` directory is not deployed as part of the Next.js app; it runs locally via `bun mcp/server.ts`.

---

## Shared Patterns

### Environment Variable Injection
**Applies to:** All Railway service configuration

All 3 required vars are consumed via bare `process.env.*` with no `dotenv` call in source — Next.js handles `.env` loading in dev. In production on Railway, vars must be set via Railway dashboard (Service → Variables tab) before the first deploy.

| Variable | Hardness | Missing behavior |
|---|---|---|
| `DATABASE_URL` | Hard (`!`) | App crashes at Prisma client init |
| `OPENROUTER_API_KEY` | Hard (`!`) | Chat/food API calls throw at runtime |
| `USDA_API_KEY` | Soft (`?? 'DEMO_KEY'`) | Falls back to 30 req/hr DEMO_KEY |

### Prisma Client Generation Path
**Applies to:** Build step and any new files that import Prisma

All Prisma imports use `@/app/generated/prisma/client` (not the standard `@prisma/client`). This is the custom `output` path in `schema.prisma`. Any new file that needs database access must use this import path, and the build step must always run `prisma generate` first.

**Pattern to copy for new DB-accessing files:**
```typescript
import { prisma } from '@/app/lib/prisma'
```
Never import directly from `@/app/generated/prisma/client` in application code — always go through the singleton in `app/lib/prisma.ts`.

### No Custom Server / No PORT Binding
**Applies to:** Railway start command

The app uses Next.js built-in server via `next start`. There is no `server.ts`, no `express()`, no `app.listen(PORT)`. Railway's automatic PORT injection works as-is. The planner should NOT add PORT-binding code.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `railway.json` | config | n/a | No Railway config files exist in codebase; planner should follow Railway nixpacks Next.js defaults from RESEARCH.md |

---

## Metadata

**Analog search scope:** `app/`, `mcp/`, project root config files
**Files scanned:** 10
**Pattern extraction date:** 2026-06-03
