---
phase: 03-production-deployment
plan: "01"
subsystem: infra
tags: [railway, nixpacks, next.js, deployment]

requires:
  - phase: 02
    provides: 9-tool MCP server + Claude Desktop config

provides:
  - package.json with PORT-aware start script
  - railway.json with restart policy
  - Live Railway deployment at diet-app-production-1d69.up.railway.app

affects: [phase-03-02, phase-03-03]

tech-stack:
  added: []
  patterns:
    - next start -p ${PORT:-3000} for Railway PORT binding
    - railway.json minimal config (restart policy only — let nixpacks auto-detect)

key-files:
  created:
    - railway.json — restart policy, NIXPACKS builder (build/start commands auto-detected)
  modified:
    - package.json — start script now `next start -p ${PORT:-3000}`, added packageManager field

key-decisions:
  - "Removed explicit buildCommand/startCommand from railway.json — Railway auto-detect works correctly from GitHub"
  - "nixpacks.toml tried and removed — caused bun v1.1.43 vs bun.lock v2 mismatch and Prisma Node.js preinstall failures"
  - "packageManager: npm@10.9.7 added but Railway still uses bun (from bun.lock detection) — harmless"
  - "bun run start used by Railway internally, executes next start -p ${PORT:-3000}"
  - "railway up command not recommended — uses different nixpkgs snapshot than GitHub deploy"

requirements-completed:
  - DEPLOY-01

duration: 25min
completed: 2026-06-03
---

# Phase 3 Plan 01: Railway Deploy Config Summary

**package.json PORT fix + railway.json created; Railway app live at diet-app-production-1d69.up.railway.app; deployment confirmed running `next start -p ${PORT:-3000}`**

## Performance

- **Duration:** ~25 min (includes deploy debugging)
- **Started:** 2026-06-03T17:10:00Z
- **Completed:** 2026-06-03T17:35:00Z
- **Tasks:** 2 auto + 1 human (Railway already existed — skipped)
- **Files modified:** 2 (package.json, railway.json)

## Accomplishments

- PORT fix: `next start -p ${PORT:-3000}` — Railway now binds to injected PORT (verified in deploy logs: listening on 8080)
- railway.json created with restart policy (ON_FAILURE, max 3 retries)
- Railway service `Diet-App` already exists in Waddle project — no new project needed
- All 3 env vars already set: DATABASE_URL, OPENROUTER_API_KEY, USDA_API_KEY
- Successful deploy from GitHub push — app returns HTTP 200

## Task Commits

1. `37c063c` — Initial railway.json + PORT fix (bun commands — caused failures)
2. `1bbb241` — Fix railway.json to bun run start
3. `e5c2e80` — Add nixpacks.toml (failed — bun v1.1.43 lockfile issue)
4. `de22171` — Add nodejs_22 to nixpacks (failed — Prisma Node.js version check)
5. `bca34b5` — Remove nixpacks.toml, strip build overrides from railway.json
6. `152db25` — Fix .gitignore, remove accidental worktree submodule
7. Final GitHub push → successful deploy

## Files Created/Modified

- `package.json` — start: `next start -p ${PORT:-3000}`, packageManager: `npm@10.9.7`
- `railway.json` — restart policy only (no build/start command overrides)
- `.gitignore` — added `.claude/worktrees/`

## Decisions Made

- Railway auto-detection is reliable for GitHub-connected deploys; `railway up` CLI upload uses older nixpkgs that can't handle bun.lock v2
- Use `git push` to trigger deploys, not `railway up`

## Deviations from Plan

1. Railway project already existed (Diet-App in Waddle project) — Task 3 human checkpoint skipped
2. nixpacks.toml added then removed after causing bun/Node.js version failures
3. Several deploy iterations needed to find correct configuration

## Issues Encountered

- `railway up` uses bun v1.1.43 which can't parse bun.lock v2 format → use GitHub deploy instead
- nixpkgs nodejs_22 too old for Prisma 7 (requires Node.js 22.12+) → removing explicit overrides fixed it

## User Setup Required

None — Railway already configured with all env vars and GitHub connection.

## Next Phase Readiness

- App live and responding at https://diet-app-production-1d69.up.railway.app
- Phase 3 Plan 02: verify meal logging works end-to-end on live URL
- Phase 3 Plan 03: smoke test MCP + live data

---
*Phase: 03-production-deployment*
*Completed: 2026-06-03*
