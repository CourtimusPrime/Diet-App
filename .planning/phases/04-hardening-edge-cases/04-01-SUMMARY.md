---
phase: 04-hardening-edge-cases
plan: "01"
subsystem: usda-integration
tags: [deduplication, data-integrity, nutrient-mapping, usda]
dependency_graph:
  requires: []
  provides: [DUPLICATE_NUTRIENT_IDS, nutrientsToColumns-dedup]
  affects: [app/lib/usda.ts]
tech_stack:
  added: []
  patterns: [Set-based deduplication, first-seen-wins, console.warn audit trail]
key_files:
  created: []
  modified:
    - app/lib/usda.ts
decisions:
  - "First-seen-wins strategy for duplicate nutrientIds — preserves verified Foundation Foods data over ambiguous SR Legacy entries"
  - "console.warn (not throw) for duplicates — silent corruption is worse than noise; app continues functioning"
  - "DUPLICATE_NUTRIENT_IDS documents known conflicts separately from NUTRIENT_ID_TO_COLUMN — single source of truth for auditing"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-03"
---

# Phase 4 Plan 01: USDA Nutrient ID Deduplication Summary

**One-liner:** DUPLICATE_NUTRIENT_IDS constant + seenIds Set in nutrientsToColumns prevents silent nutrient column overwrite when USDA returns the same nutrientId twice (e.g. ID 1278 EPA vs SR Legacy palmitoleic alias).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add DUPLICATE_NUTRIENT_IDS and seenIds deduplication | 0d95e69 | app/lib/usda.ts |

## What Was Built

Added two changes to `app/lib/usda.ts`:

1. **`DUPLICATE_NUTRIENT_IDS` exported constant** — a `Record<number, { note: string }>` placed immediately after `NUTRIENT_ID_TO_COLUMN`. Documents nutrientId 1278 as a known cross-dataset ambiguity: SR Legacy may emit 1278 for palmitoleic acid, but Foundation Foods uses 1267 for that. This codebase retains the EPA mapping (1278 → `pufa_20_5_epa_g`) as the authoritative value.

2. **`seenIds` Set in `nutrientsToColumns()`** — a `Set<number>` initialized empty at the start of the function body. For each nutrient in the USDA response:
   - If `nutrientId` is already in `seenIds`: emit `console.warn` with the ID and column name, then `continue` (skip).
   - Otherwise: `seenIds.add(nutrientId)`, then proceed with existing column-mapping + scaling logic.

Existing behavior for all non-duplicate nutrientIds is completely unchanged.

## Verification

- `npx tsc --noEmit` — zero errors in `usda.ts` (pre-existing unrelated errors in `mcp/route.ts` and `chat/route.ts` excluded per scope boundary)
- `grep -c "seenIds" app/lib/usda.ts` → 3 (Set declaration + `.has` + `.add`)
- `grep "DUPLICATE_NUTRIENT_IDS" app/lib/usda.ts` → exported constant found
- `grep "1278" app/lib/usda.ts` → ID 1278 documented in both `NUTRIENT_ID_TO_COLUMN` and `DUPLICATE_NUTRIENT_IDS`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this plan closes threat T-04-01 (Tampering via duplicate nutrientId). No new trust boundaries introduced.

## Self-Check: PASSED

- [x] `app/lib/usda.ts` modified and exists
- [x] Commit `0d95e69` exists in git log
- [x] DUPLICATE_NUTRIENT_IDS exported with key 1278
- [x] seenIds used 3 times in nutrientsToColumns
- [x] TypeScript compiles clean for usda.ts
