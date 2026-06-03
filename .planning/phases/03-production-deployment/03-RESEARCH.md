# Phase 03: Production Deployment — Research

**Researched:** 2026-06-03
**Domain:** Railway deployment — Next.js 14 + Prisma 7 + bun.lock + nixpacks/Railpack
**Confidence:** HIGH (Q1, Q3, Q4, Q5), MEDIUM (Q2 custom output path), LOW (Q6 internal URL inheritance)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. Create new Railway project "nutrilog" (clean separation from NCZ business projects)
2. nixpacks auto-detect — no Dockerfile
3. Node runtime on Railway (bun is dev-only)
4. Reuse existing DATABASE_URL (schema already pushed, data live)
5. Use package.json `start` script (`next start`)
6. `prisma db push` workflow — no migrations directory, no `prisma migrate deploy`
7. Phase 03-03 (Claude Desktop config) already done in Phase 2 — skip
8. Railway auto-injects PORT

### Claude's Discretion
- Exact `start` command wording (whether to add `-p $PORT` flag — see below)
- Whether a `railway.json` is needed

### Deferred Ideas (OUT OF SCOPE)
- Custom domain, SSL cert, CDN
- Auth (Phase 3.1)
- Rate limiting (Phase 4)
</user_constraints>

---

## Summary

Railway deploys Next.js 14 App Router apps automatically via nixpacks/Railpack — no `railway.json` or `nixpacks.toml` required for this stack. The `build` script in `package.json` (`prisma generate && next build`) runs as-is on Railway; nixpacks executes it exactly.

**One required fix:** The current `start` script is `next start` (no port flag). Railway's official docs and troubleshooting guide explicitly state that Next.js does **not** automatically read the `PORT` env var — it must be passed via the `-p` flag. The `start` script must be changed to `next start -p ${PORT:-3000}` or the app will bind to port 3000 and Railway will route to the wrong port, causing "Application failed to respond" 502 errors.

**Bun warning:** The repo has `bun.lock` (text format, Bun v1.2+), not `bun.lockb` (binary). nixpacks v1.31.0+ supports `bun.lock`, but an older nixpacks version bundled in Railway had a bug (`InvalidLockfileVersion`) parsing the new format. If Railway is on nixpacks < v1.31.0, it may fall back to npm instead of bun. Since production should use Node/npm anyway (locked decision), the safe path is to force npm via `packageManager` field or `nixpacks.toml`. See Pitfalls.

**Primary recommendation:** Fix the `start` script, create `railway.json` to pin the build/start commands explicitly, and set `DATABASE_URL` as a reference variable pointing to the Railway PostgreSQL service.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP serving | Frontend Server (Railway container) | — | `next start` serves SSR and API routes |
| DB connectivity | API / Backend (Prisma/pg) | Database (Railway PostgreSQL) | PrismaPg adapter connects via DATABASE_URL |
| Build execution | CI/Build (nixpacks) | — | `prisma generate && next build` runs in builder container |
| Secret injection | Railway env vars | — | DATABASE_URL, OPENROUTER_API_KEY, USDA_API_KEY injected at runtime |
| Port routing | Railway networking | Frontend Server | Railway injects PORT; app must bind to it |

---

## Q1: Does nixpacks auto-detect Next.js 14 correctly?

**Answer: Yes — with one caveat (PORT).**

nixpacks/Railpack detects Next.js automatically from `package.json` presence. It:
- Uses the `build` script verbatim (`prisma generate && next build`)
- Uses the `start` script verbatim (`next start`)
- Installs dependencies with the detected package manager before running build
- Caches `.next/cache` for incremental builds

No `railway.json` or `nixpacks.toml` is required for detection to work. However, a minimal `railway.json` is recommended (see Q4) to make build/start commands explicit and resilient to future nixpacks changes.

[CITED: docs.railway.com/guides/nextjs]

---

## Q2: Does `prisma generate` in the build work on Railway with custom output?

**Answer: Yes — but with a known risk.**

The build script `prisma generate && next build` runs in the nixpacks build container. `prisma generate` with `output = "../app/generated/prisma"` (as in this project's schema) writes the generated client files into the app source tree before `next build` compiles them. This is the correct sequence.

**Risk:** Prisma 7's custom output path places generated `.ts` files inside the `app/` directory. Next.js's webpack/Turbopack may lint or type-check these files and encounter ESM `.js` import extensions that don't resolve at build time (known issue: `prisma/prisma#28627`). This project uses Webpack (Next.js 14 default), which is less affected than Turbopack. The existing local `next build` must already be passing since the project reached Phase 2 successfully — Railway will run the same build.

**The critical requirement:** `prisma generate` must run BEFORE `next build` in the same build step. The current `build` script already does this correctly. Do NOT split them into separate commands.

**What `prisma generate` does NOT need:** A live database connection. It reads `schema.prisma` only. DATABASE_URL is not required during build, only at runtime.

[CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7]
[ASSUMED: nixpacks/Railpack build container has the same behavior as a standard Node.js environment for this step — no contrary evidence found]

---

## Q3: Does Railway's PORT env var work with `next start` out of the box?

**Answer: No — `next start` does NOT read PORT automatically in Next.js 14.**

Railway's official troubleshooting docs state explicitly:

> "Next needs an additional flag to listen on PORT: `next start --port ${PORT-3000}`"

Without this flag, `next start` always binds to port 3000. Railway routes traffic to whatever port the app binds to (detected via `PORT` env var injection), so there is a mismatch. The result is an "Application failed to respond" 502 error.

**Required fix:**
```json
"start": "next start -p ${PORT:-3000}"
```

Note: `${PORT:-3000}` is bash parameter expansion (fallback to 3000 if PORT is unset — works for local dev). `${PORT-3000}` is Railway's documented form (equivalent).

[CITED: docs.railway.com/networking/troubleshooting/application-failed-to-respond]
[CITED: station.railway.com/questions/next-js-application-failed-to-respond-c663ef67]

---

## Q4: Is a `railway.json` or `nixpacks.toml` needed?

**Answer: Not strictly required, but a `railway.json` is recommended.**

nixpacks auto-detects correctly without config. However, creating a minimal `railway.json` is best practice because:
1. Makes build/start commands explicit — survives nixpacks builder changes
2. Lets you see and audit exactly what Railway runs
3. Allows setting `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` for graceful shutdown if needed later

**Recommended `railway.json`:**
```json
{
  "$schema": "https://schema.railway.app/railway-schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

This delegates to the `package.json` scripts, so the single source of truth for build/start logic stays in `package.json`.

[CITED: docs.railway.com/builds/build-configuration]
[ASSUMED: `railway.json` schema above — structure is consistent with Railway examples but exact field names should be verified in Railway dashboard JSON editor]

---

## Q5: Bun-specific issues on Railway with `bun.lock`

**Answer: Important — force Node/npm to avoid bun detection confusion.**

The repo has `bun.lock` (Bun v1.2 text format). nixpacks behavior:
- Original bun detection looked for `bun.lockb` (binary format) — `bun.lock` was not recognized
- nixpacks v1.31.0 added support for `bun.lock` (text format) via PR #1245
- Railway may be on any nixpacks version — there is no user-visible pinning
- Older nixpacks parsing `bun.lock` threw `InvalidLockfileVersion` errors and fell back to npm

Since the locked decision is **Node runtime on Railway**, actively prevent bun detection:

**Option A (recommended): Add `packageManager` field to `package.json`**
```json
"packageManager": "npm@10.9.7"
```
nixpacks respects the `packageManager` field and uses npm, bypassing lockfile detection.

**Option B: Add `nixpacks.toml` at project root**
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm install"]
```

Option A is simpler and keeps all config in `package.json`. Either prevents accidental bun invocation.

[CITED: github.com/railwayapp/nixpacks/discussions/261 — bun detection mechanism]
[CITED: coollabsio/coolify#5219 — bun.lock InvalidLockfileVersion bug in older nixpacks]
[ASSUMED: exact current Railway nixpacks version — not user-visible in dashboard]

---

## Q6: DATABASE_URL — external proxy vs Railway internal reference variable

**Answer: Use Railway reference variable pointing to internal URL.**

| Approach | URL Format | Cost | Latency | Recommended |
|----------|-----------|------|---------|-------------|
| Hardcode external proxy | `postgresql://...@zephyr.proxy.rlwy.net:29839/...` | Egress billing | Higher (public internet) | No |
| Reference variable (internal) | `${{Postgres.DATABASE_URL}}` → `postgresql://...@postgres.railway.internal:5432/...` | None | Low (private network) | Yes |

The Railway PostgreSQL service exposes `DATABASE_URL` (internal) and `DATABASE_PUBLIC_URL` (external proxy). When app service and DB are in the same Railway project, the internal URL routes over Railway's private network — faster and no egress charges.

**Setup in Railway Variables tab:**
```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
```

Railway substitutes this at runtime with the internal connection string. If the DB service is renamed, the reference auto-updates (no redeploy needed for name changes).

**Note:** The existing `prisma.ts` reads `process.env.DATABASE_URL` directly — no code change needed. The `PrismaPg` adapter uses the connection string at runtime, not build time.

[CITED: blog.railway.com/p/database-reference-variables]
[CITED: docs.railway.com/databases/postgresql]
[ASSUMED: exact `${{Postgres.DATABASE_URL}}` syntax — consistent across multiple Railway docs pages but Railway service name may differ from "Postgres" — verify in dashboard]

---

## Standard Stack

### What Railway Uses for This Project

| Layer | Tool | How Configured |
|-------|------|---------------|
| Builder | nixpacks / Railpack (Railway auto) | `"builder": "NIXPACKS"` in railway.json |
| Install | npm (after fixing packageManager field) | `packageManager: "npm@10.x"` in package.json |
| Build | `npm run build` → `prisma generate && next build` | package.json scripts |
| Start | `npm run start` → `next start -p ${PORT:-3000}` | package.json scripts (after fix) |
| Runtime | Node 20 (nixpacks default for Next.js 14) | auto-detected |
| Database | Railway PostgreSQL (existing) | Reference variable |

### No Additional Packages Needed

This phase is infrastructure/config only. No new npm packages are installed.

---

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All packages already in `package.json` are in production use (Phase 1+2 complete).

---

## Architecture Patterns

### Deployment Flow

```
Git push to Railway
       |
       v
nixpacks detects Node + Next.js
       |
       v
npm install (all deps including prisma)
       |
       v
npm run build
  ├── prisma generate → writes to app/generated/prisma/
  └── next build → compiles app including generated client
       |
       v
Container image stored
       |
       v
Deploy: npm run start
  └── next start -p $PORT
       |
       v
Railway routes *.railway.app → container:$PORT
```

### Environment Variable Chain

```
Railway PostgreSQL service
  └── DATABASE_URL (internal postgres.railway.internal URL)
         |
         v (reference variable)
Railway App service
  └── DATABASE_URL = ${{Postgres.DATABASE_URL}}
         |
         v (runtime injection)
Next.js process.env.DATABASE_URL
         |
         v
PrismaPg({ connectionString: process.env.DATABASE_URL })
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Cross-service env sharing | Manual copy-paste of DB credentials | Railway reference variables (`${{Postgres.DATABASE_URL}}`) |
| Port binding | Hardcode port 3000 | `next start -p ${PORT:-3000}` |
| Build caching | Custom cache layers | nixpacks auto-caches `.next/cache` |

---

## Common Pitfalls

### Pitfall 1: `next start` ignores PORT (THE critical fix)
**What goes wrong:** App binds to 3000, Railway routes to injected `$PORT` (random high port) → 502 "Application failed to respond"
**Root cause:** Next.js `next start` does not read `PORT` env var without `-p` flag, unlike most Node frameworks
**Fix:** `"start": "next start -p ${PORT:-3000}"`
**Warning signs:** Immediate 502 on first deploy; Railway logs show app running but health checks fail

### Pitfall 2: Bun detection triggers wrong package manager
**What goes wrong:** nixpacks detects `bun.lock` and attempts bun install; older nixpacks version throws `InvalidLockfileVersion`; build fails
**Root cause:** `bun.lock` text format requires nixpacks v1.31.0+; Railway may run older version
**Fix:** Add `"packageManager": "npm@10.9.7"` to `package.json` to force npm
**Warning signs:** Build log shows "bun install" instead of "npm install"; then lockfile parse error

### Pitfall 3: Prisma generated files not in container at runtime
**What goes wrong:** App crashes at boot with "Cannot find module '../generated/prisma/client'"
**Root cause:** `prisma generate` was run separately from build, or build command was overridden to skip it
**Fix:** Keep `build` script as `prisma generate && next build` — both run in the same build step in the same container layer
**Warning signs:** Build succeeds but runtime crashes on first request to any DB-backed route

### Pitfall 4: Using external proxy DATABASE_URL internally
**What goes wrong:** App works but incurs Railway egress charges on every DB query; higher latency
**Root cause:** Hardcoding `zephyr.proxy.rlwy.net` URL instead of using the internal reference variable
**Fix:** Set `DATABASE_URL = ${{Postgres.DATABASE_URL}}` in app service Variables tab
**Warning signs:** Railway usage dashboard shows egress charges from app service

### Pitfall 5: Database in different Railway project
**What goes wrong:** Internal reference variable `${{Postgres.DATABASE_URL}}` resolves to empty or internal URL not reachable cross-project
**Root cause:** Internal Railway networking only spans a single project
**Fix:** Either create new PostgreSQL in the same project as the app, or use `DATABASE_PUBLIC_URL`
**Warning signs:** App service Variables tab shows reference variable with no preview value

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Railway PostgreSQL | DATABASE_URL | Yes | Existing, live at `zephyr.proxy.rlwy.net:29839` |
| Node 20 (Railway) | next build / next start | Yes (auto) | nixpacks installs Node 20 for Next.js 14 |
| npm | dependency install | Yes (auto) | After `packageManager` field fix |
| OPENROUTER_API_KEY | LLM food parsing | Must be set manually | Set in Railway Variables tab |
| USDA_API_KEY | USDA FoodData Central API | Must be set manually | DEMO_KEY works if omitted (30 req/hr cap) |

**Missing dependencies with no fallback:**
- OPENROUTER_API_KEY — meal logging will fail without it; must be set in Railway Variables tab before first deploy test

**Missing dependencies with fallback:**
- USDA_API_KEY — app falls back to DEMO_KEY (30 req/hr); sufficient for smoke testing

---

## Validation Architecture

Validation for this phase is manual — no automated tests cover Railway deployment itself.

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| Build succeeds | Railway deploy logs | "Build succeeded" in logs |
| App starts | Railway deploy logs | "Starting..." → "Listening on port" |
| Health check | Browser: visit Railway URL | Next.js homepage renders |
| DB write | Log a meal via UI | Meal appears in Railway PostgreSQL |
| DB read (MCP) | Claude Desktop `get_meals` | Returns real logged meals |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `railway.json` field names (`buildCommand`, `startCommand`, etc.) | Q4 | railway.json may be rejected; use dashboard UI instead |
| A2 | nixpacks version on Railway may be < v1.31.0 | Q5 | bun.lock might actually parse fine; npm override is still harmless |
| A3 | `${{Postgres.DATABASE_URL}}` syntax resolves to internal URL in same project | Q6 | May need `${{Postgres.DATABASE_PRIVATE_URL}}` — verify in Railway dashboard preview |
| A4 | DB and app will be in same Railway project | Q6 | If separate projects, must use public URL + no egress-free path |

---

## Open Questions

1. **Railway project structure:** Is the PostgreSQL service in the SAME Railway project that the new "nutrilog" app service will be added to? CONTEXT.md says "create new project nutrilog" but the DB is already live in an existing project. If they are separate projects, the internal reference variable will not work and the external proxy URL must be used.

   - What we know: DB is at `zephyr.proxy.rlwy.net:29839` (external proxy URL)
   - What's unclear: Which Railway project the DB lives in
   - Recommendation: Check Railway dashboard — if DB is in a different project from the new "nutrilog" app service, use `DATABASE_PUBLIC_URL` (external proxy) instead of the internal reference variable

2. **`railway.json` schema:** The exact JSON schema for Railway's config file was not verified against a live schema document.
   - Recommendation: After creating `railway.json`, validate it using Railway's dashboard JSON editor which highlights schema errors inline

---

## Sources

### Primary (HIGH confidence)
- [docs.railway.com/networking/troubleshooting/application-failed-to-respond](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond) — Next.js PORT flag requirement (explicitly documented)
- [docs.railway.com/guides/nextjs](https://docs.railway.com/guides/nextjs) — Railway Next.js deployment guide
- [prisma.io/docs/guides/upgrade-prisma-orm/v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — Prisma 7 custom output requirement
- [blog.railway.com/p/database-reference-variables](https://blog.railway.com/p/database-reference-variables) — Reference variable syntax and internal URL behavior

### Secondary (MEDIUM confidence)
- [station.railway.com — Next.js failed to respond](https://station.railway.com/questions/next-js-application-failed-to-respond-c663ef67) — Confirmed PORT fix with Railway staff response
- [nixpacks.com/docs/providers/node](https://nixpacks.com/docs/providers/node) — packageManager field detection
- [github.com/railwayapp/nixpacks/discussions/261](https://github.com/railwayapp/nixpacks/discussions/261) — Bun detection mechanism (maintainer comment)

### Tertiary (LOW confidence — flagged)
- [coollabsio/coolify#5219](https://github.com/coollabsio/coolify/issues/5219) — bun.lock parse error in older nixpacks (Coolify, not Railway — behavior may differ)

---

## Metadata

**Confidence breakdown:**
- PORT fix (Q3): HIGH — explicitly in Railway official troubleshooting docs
- nixpacks auto-detect (Q1): HIGH — documented in Railway Next.js guide
- Prisma generate in build (Q2): HIGH for sequence; MEDIUM for custom output path risk
- railway.json need (Q4): HIGH for "optional"; MEDIUM for exact schema
- Bun detection (Q5): MEDIUM — nixpacks version on Railway not user-visible
- DATABASE_URL reference variable (Q6): HIGH for approach; MEDIUM for exact syntax

**Research date:** 2026-06-03
**Valid until:** 2026-09-01 (Railway docs change infrequently; Prisma 7 is current)
