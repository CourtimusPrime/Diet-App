---
phase: "03-production-deployment"
type: context
source: smart-discuss-autonomous
created: 2026-06-03
---

# Phase 3: Production Deployment — Context

## Objective

Deploy the NutriLog Next.js app to Railway so the web UI is publicly accessible. Env vars set, migration runs on startup, app serves traffic. Claude Desktop MCP wiring already complete (done in Phase 2).

## Codebase State Going In

- **Stack**: Next.js 14 App Router, Prisma 7, bun runtime
- **DB**: Railway PostgreSQL already live at `zephyr.proxy.rlwy.net:29839` — schema already pushed via `prisma db push`
- **No Dockerfile / railway.json / nixpacks.toml** — needs to be created
- **package.json scripts**: `build: "prisma generate && next build"`, `start: "next start"`
- **3 env vars needed**: `DATABASE_URL`, `OPENROUTER_API_KEY`, `USDA_API_KEY`
- **Claude Desktop config**: Already done (Phase 2) — `~/.config/Claude/claude_desktop_config.json` has nutrilog entry with all env vars

## Grey Areas — Auto-Answered

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Create new Railway project or add service to existing DB project? | **Create new project "nutrilog"** | Clean separation; existing NCZ projects are unrelated business projects |
| 2 | Build system: nixpacks auto-detect vs Dockerfile? | **nixpacks auto-detect** | Railway detects Next.js automatically via package.json; no Dockerfile needed |
| 3 | Runtime: bun vs Node for Railway? | **Node (Railway default)** | Railway nixpacks uses Node by default; `npm run build` and `npm run start` work; bun is dev-only for this project |
| 4 | DB: create new PostgreSQL on Railway or reuse existing? | **Reuse existing DATABASE_URL** | Schema already pushed and data already in Railway DB; no migration needed |
| 5 | Start command for Railway? | **Use package.json `start` script** | `next start` is the correct production command; Railway auto-detects it |
| 6 | `prisma migrate deploy` vs `prisma db push` on startup? | **`prisma db push` via build script** | No migrations dir exists (using db push workflow); `build` script already runs `prisma generate` |
| 7 | Phase 3 plan 03-03 overlap (Claude Desktop config)? | **Mark 03-03 complete / skip** | Claude Desktop config fully done in Phase 2 — config written with bun command, env vars, cwd |
| 8 | Port binding? | **Railway auto-injects PORT** | Next.js respects PORT env var; no special config needed |
| 9 | .env.example? | **Create with all 3 required vars** | Part of Phase 3 SC4 — documents required variables |

## Phase 3 Success Criteria (from ROADMAP)

1. Railway deployment succeeds with `prisma migrate deploy && next start` and app reachable at Railway URL
2. Logging a meal via live URL creates DB record visible via MCP
3. Claude Desktop can call `get_meals` and return real logged meals from Railway database
4. `.env.example` documents all required variables with descriptions

## Scope Fences

- **IN**: Railway project creation, service setup, env vars, first deploy, smoke test, .env.example
- **OUT**: Custom domain, SSL cert, CDN, auth (Phase 3.1), rate limiting (Phase 4)
- **DONE (Phase 2)**: Claude Desktop config — no work needed here

## Key Constraints

- Schema uses `prisma db push` not migrations — no `prisma migrate deploy` needed
- Build command must run `prisma generate` before `next build` (already in package.json `build` script)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` NOT needed — no auth in Phase 3 (auth is Phase 3.1)
- Railway PostgreSQL connection from Railway service: use internal `DATABASE_URL` (Railway injects this automatically when DB and app are in same project) OR set it explicitly
