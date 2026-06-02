---
phase: 01-logging-core
plan: 02
subsystem: usda-integration
tags: [usda, nutrients, typescript, api-client, nutrient-map]

requires:
  - 01-01  # prisma/schema.prisma Float? column names

provides:
  - NUTRIENT_ID_TO_COLUMN map (103 entries, USDA nutrientId -> Prisma column name)
  - searchUSDA() async function (USDA FoodData Central search with retry + priority)
  - nutrientsToColumns() sync function (per-100g USDA values -> consumed quantity)

affects:
  - 01-03 (chat API route imports searchUSDA, nutrientsToColumns from '@/lib/usda')
  - 02 (MCP server may reference NUTRIENT_ID_TO_COLUMN for column enumeration)

tech-stack:
  added: []
  patterns:
    - USDA FDC search with " raw" suffix retry strategy
    - DATA_TYPE_PRIORITY sort for Foundation > SR Legacy > Survey > Branded
    - Graceful null return on USDA fetch error or empty results (never throws)
    - Per-100g to consumed-quantity scaling: (value * quantityG) / 100

key-files:
  created:
    - app/lib/usda.ts
  modified: []

key-decisions:
  - "1184 assigned to vitamin_k2_mcg — distinct from 1185 (vitamin_k1_mcg); menaquinone-4 ID from FDC pattern"
  - "searchUSDA never throws — returns null on HTTP error, empty results, or fetch exception per USDA-01"
  - "nutrientsToColumns returns Record<string,number> (not null values) — caller spreads directly into Prisma create"
  - "USDA_API_KEY accessed only via process.env in server-side module; DEMO_KEY is safe fallback per T-01-03"
  - "Unknown nutrientIds silently ignored — unknown API surface does not crash meal save per T-01-04"

requirements-completed: [USDA-01, USDA-02, USDA-03, USDA-05]

duration: 3min
completed: 2026-06-02
---

# Phase 01 Plan 02: USDA Integration Module Summary

**NUTRIENT_ID_TO_COLUMN map with 103 entries mirroring schema exactly, searchUSDA() with raw-suffix retry and dataType priority sorting, nutrientsToColumns() scaling per-100g USDA values to consumed quantity**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-02T09:44:56Z
- **Completed:** 2026-06-02T09:48:00Z
- **Tasks:** 2
- **Files created:** 1

## Accomplishments

- `app/lib/usda.ts` created with all required exports: `NUTRIENT_ID_TO_COLUMN`, `CORE_NUTRIENT_COLUMNS`, `DATA_TYPE_PRIORITY`, `USDAFoodNutrient`, `USDAFood`, `USDASearchResponse`, `searchUSDA`, `nutrientsToColumns`
- `NUTRIENT_ID_TO_COLUMN` has exactly 103 entries — every value is a valid Float? column in `prisma/schema.prisma` (0 mismatches verified via tsx cross-check)
- No duplicate column names in the map (103 unique keys, 103 unique values)
- All spot-checks pass: `[1003]=protein_g`, `[1008]=energy_kcal`, `[2047]=energy_atwater_general_kcal`, `[1210]=tryptophan_g`, `[1258]=sfa_total_g`
- `searchUSDA()` implements " raw" suffix retry strategy, dataType priority sort, graceful null return
- `nutrientsToColumns()` correctly scales by (quantityG / 100) and ignores unknown IDs / null values
- Zero TypeScript errors in `usda.ts` (pre-existing `prisma.ts` error unrelated to this plan)

## Task Commits

1. **Task 1: NUTRIENT_ID_TO_COLUMN map, interfaces, constants** - `1591726` (feat)
2. **Task 2: searchUSDA() and nutrientsToColumns()** - `40427d5` (feat)

## Files Created/Modified

- `app/lib/usda.ts` - Complete USDA integration module; 245 lines; exports all types, constants, and functions required by `app/api/chat/route.ts`

## Decisions Made

1. **vitamin_k2_mcg -> ID 1184** — Distinct from ID 1185 (vitamin_k1_mcg/phylloquinone). Menaquinone-4 (MK-4) is nutrient ID 1184 in the FDC dataset. RESEARCH.md noted the ambiguity; resolved by using 1184 for K2 and keeping 1185 for K1.
2. **searchUSDA returns null, not throws** — Per CONTEXT.md USDA decision: "Zero results: store FoodItem with null nutrient columns, set usdaMatched=false — never block the meal save". Both fetch errors and empty results return null.
3. **nutrientsToColumns returns `Record<string, number>`** — Not `Record<string, number | null>` (the RESEARCH.md pattern example). Null-valued USDA nutrients are skipped entirely, so the returned object only contains non-null scaled values. This is cleaner for Prisma spread operations.
4. **Unknown dataTypes sort last** — When a food's dataType is not in DATA_TYPE_PRIORITY, it gets `Infinity` index and sorts after all known types. This is a safe fallback.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed on first attempt with no bugs or missing functionality discovered.

## Known Stubs

None — `app/lib/usda.ts` has no placeholder values, hardcoded mock data, or TODO comments. The [ASSUMED] notes on nutrient IDs are documentation comments, not stubs — the IDs are functional values that will be verified with a registered USDA API key per RESEARCH.md guidance.

## Threat Flags

No new security surface beyond what the plan's threat model covers. Verified:
- `USDA_API_KEY` accessed only via `process.env` on line 181 — server-side only, not exported to client (T-01-03 mitigated)
- `NUTRIENT_ID_TO_COLUMN` lookup silently ignores unknown nutrientIds — no eval, no dynamic SQL (T-01-04 mitigated)
- `searchUSDA` returns null on non-ok HTTP response — DEMO_KEY 429s are handled gracefully (T-01-05 accepted)
- No new npm packages installed — uses built-in `fetch` only (T-01-SC mitigated)

## Next Phase Readiness

- `app/api/chat/route.ts` (Plan 01-03) can import all three exports: `import { searchUSDA, nutrientsToColumns, NUTRIENT_ID_TO_COLUMN } from '@/lib/usda'`
- `searchUSDA(foodName)` returns `USDAFood | null` — caller must handle null with `usdaMatched=false` path
- `nutrientsToColumns(food, quantityG)` returns `Record<string, number>` ready to spread into Prisma FoodItem create
- No blockers for subsequent plans

---
*Phase: 01-logging-core*
*Completed: 2026-06-02*
