---
phase: 01-logging-core
plan: 01
subsystem: database
tags: [prisma, postgresql, railway, schema, orm]

requires: []
provides:
  - Prisma schema with Meal, FoodItem (103 Float? nutrient columns), DailyTarget models
  - Railway PostgreSQL tables created via prisma db push
  - PrismaClient singleton at app/lib/prisma.ts for all server-side DB access
affects:
  - 01-02 (USDA helper needs schema column names for NUTRIENT_ID_TO_COLUMN map)
  - 01-03 (chat API route imports prisma singleton)
  - 01-04 (ChatInterface reads meal data from DB via API)
  - 02 (MCP server queries same Railway PostgreSQL via same schema)

tech-stack:
  added: [prisma@7.8.0, @prisma/client@7.8.0]
  patterns:
    - Wide-column FoodItem schema (103 Float? columns) for SQL aggregation without joins
    - PrismaClient singleton via globalThis for Next.js hot-reload safety
    - Prisma 7 custom output path (app/generated/prisma) with import from client.ts

key-files:
  created:
    - prisma/schema.prisma
    - app/lib/prisma.ts
  modified: []

key-decisions:
  - "Used prisma-client (not prisma-client-js) as generator provider — Prisma 7 naming"
  - "Removed url from datasource block — Prisma 7 reads DATABASE_URL via prisma.config.ts only"
  - "Import path for singleton: @/app/generated/prisma/client (no index.ts in generated dir)"
  - "Bioactives/Other group has 22 columns to reach exactly 103 total Float? columns"
  - "db push used for dev iteration; migrate deploy for production (per pitfall 6 in RESEARCH.md)"

patterns-established:
  - "Pattern: Prisma 7 singleton imports from @/app/generated/prisma/client (custom output)"
  - "Pattern: datasource block has no url — config comes from prisma.config.ts only"

requirements-completed: [DB-01, DB-02, DB-03, USDA-04, USDA-05]

duration: 15min
completed: 2026-06-02
---

# Phase 01 Plan 01: Prisma Schema + db push Summary

**Wide-column PostgreSQL schema with 103 nullable nutrient columns on FoodItem, pushed to Railway via Prisma 7 db push, with hot-reload-safe singleton**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-02T08:30:00Z
- **Completed:** 2026-06-02T08:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Prisma schema validated with zero errors; Meal, FoodItem, DailyTarget models created
- FoodItem has exactly 103 Float? nutrient columns spanning proximates, minerals, vitamins, amino acids, fatty acids, and bioactives
- prisma db push succeeded — all three tables now exist in Railway PostgreSQL
- PrismaClient singleton created at app/lib/prisma.ts with correct Prisma 7 import path

## Task Commits

1. **Task 1: Write Prisma schema** - `b9cd296` (feat)
2. **Task 2: Prisma singleton + db push** - `5d4c3ec` (feat)

**Plan metadata:** (docs commit hash below after state update)

## Files Created/Modified

- `prisma/schema.prisma` - Full data model: Meal, FoodItem with 103 Float? nutrient columns, DailyTarget; cascade delete on FoodItem.mealId
- `app/lib/prisma.ts` - PrismaClient singleton with globalForPrisma pattern; imports from @/app/generated/prisma/client

## Decisions Made

1. **Generator provider is `prisma-client`** (not `prisma-client-js`) — Prisma 7 renamed the provider
2. **Datasource block has no `url` field** — Prisma 7 no longer supports url in schema; DATABASE_URL comes from prisma.config.ts
3. **Import from `@/app/generated/prisma/client`** — generated output directory has no index.ts, must import specific `client.ts` file
4. **Bioactives/Other group has 22 columns** — needed 19 beyond the plan's explicit 3 (fructose_g, lactose_g, iodine_mcg) to hit exactly 103; added carotene_alpha_mcg, vitamin_e_added_mg, vitamin_k2_mcg, folate_food_mcg, vitamin_b12_added_mcg, lutein_zeaxanthin_mcg, sugars_added_g, galactose_g, maltose_g, sfa_20_0_g, sfa_22_0_g, mufa_16_1_g, mufa_20_1_g, mufa_22_1_g, pufa_18_4_g, tocopherol_beta_mg, tocopherol_gamma_mg, tocopherol_delta_mg, fluoride_mcg

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `url` from datasource block**
- **Found during:** Task 1 (schema validation)
- **Issue:** `prisma validate` exited with error P1012: "datasource property `url` is no longer supported in schema files" in Prisma 7.8.0
- **Fix:** Removed `url = env("DATABASE_URL")` from datasource block; Prisma 7 reads connection URL exclusively from `prisma.config.ts` (already present in project from prior plan)
- **Files modified:** prisma/schema.prisma
- **Verification:** `prisma validate` exits 0 after removal
- **Committed in:** b9cd296 (Task 1 commit)

**2. [Rule 1 - Bug] Changed generator provider from `prisma-client-js` to `prisma-client`**
- **Found during:** Task 1 (matching existing project setup)
- **Issue:** Plan specified `prisma-client-js` but the project's original schema and Prisma 7 use `prisma-client`
- **Fix:** Used `provider = "prisma-client"` to match Prisma 7 naming and existing project setup
- **Files modified:** prisma/schema.prisma
- **Verification:** `prisma validate` passes; `prisma generate` succeeds
- **Committed in:** b9cd296 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added 19 more nutrient columns to reach exactly 103**
- **Found during:** Task 1 (column count verification)
- **Issue:** Plan's explicit column lists totalled 84 (11+10+20+18+22+3); plan required exactly 103
- **Fix:** Added 19 well-documented nutrients from RESEARCH.md assumed list: carotene_alpha_mcg, vitamin_e_added_mg, vitamin_k2_mcg, folate_food_mcg, vitamin_b12_added_mcg, lutein_zeaxanthin_mcg, sugars_added_g, galactose_g, maltose_g, sfa_20_0_g, sfa_22_0_g, mufa_16_1_g, mufa_20_1_g, mufa_22_1_g, pufa_18_4_g, tocopherol_beta_mg, tocopherol_gamma_mg, tocopherol_delta_mg, fluoride_mcg
- **Files modified:** prisma/schema.prisma
- **Verification:** `grep -c "Float?" prisma/schema.prisma` = 103
- **Committed in:** b9cd296 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs from Prisma 7 API changes, 1 missing critical for column count correctness)
**Impact on plan:** All auto-fixes necessary for correctness with Prisma 7. No scope creep.

## Issues Encountered

- Prisma 7 has breaking changes from Prisma 5/6 in schema syntax (no `url` in datasource, renamed generator provider). Both auto-fixed inline.

## User Setup Required

None — DATABASE_URL is already in .env pointing to Railway PostgreSQL.

## Next Phase Readiness

- Railway PostgreSQL has all three tables (Meal, FoodItem, DailyTarget) ready for writes
- `app/lib/prisma.ts` exports `prisma` singleton — import as `import { prisma } from '@/app/lib/prisma'` in route handlers
- IMPORTANT: Plan 01-02 (usda.ts) needs the full column name list from this schema; use `grep "Float?" prisma/schema.prisma` to get all 103 column names for the NUTRIENT_ID_TO_COLUMN map
- No blockers for subsequent plans

## Known Stubs

None — all fields are real schema definitions backed by the Railway PostgreSQL DB.

---
*Phase: 01-logging-core*
*Completed: 2026-06-02*
