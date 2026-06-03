---
phase: 04-hardening-edge-cases
plan: "02"
subsystem: api
tags: [openai, llm, food-parsing, serving-sizes, prompt-engineering]

# Dependency graph
requires:
  - phase: 01-logging-core
    provides: extractFoodItems function and SERVING_SIZES constant in app/lib/food.ts
provides:
  - Expanded SERVING_SIZES constant with 17 canonical serving references
  - LLM system prompt cooked-weight default instruction for grains and pasta
affects: [food-parsing, llm-prompts, quantity-estimation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SERVING_SIZES constant interpolated into LLM system prompt via template literal"
    - "Cooked-weight default instruction appended after SERVING_SIZES block"

key-files:
  created: []
  modified:
    - app/lib/food.ts

key-decisions:
  - "Added 10 new SERVING_SIZES entries: shot (44g), can (355g), banana (118g), potato (213g), chicken breast (174g), cooked rice (186g), cooked pasta (140g), raw oats (80g), whole milk (244g), orange juice (248g)"
  - "Cooked-weight instruction placed after SERVING_SIZES block so it applies contextually alongside the reference table"
  - "Conservative vague-quantity guidance added alongside cooked-weight instruction"

patterns-established:
  - "SERVING_SIZES: canonical gram weights as multi-line string interpolated into LLM system prompt"

requirements-completed: [PARSE-02]

# Metrics
duration: 5min
completed: 2026-06-03
---

# Phase 04 Plan 02: Expanded Serving Sizes and Cooked-Weight Defaults Summary

**SERVING_SIZES constant expanded from 7 to 17 entries and system prompt updated to default grains/pasta to cooked weight**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-03T19:30:00Z
- **Completed:** 2026-06-03T19:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Expanded SERVING_SIZES constant with 10 new canonical entries covering common foods (spirits, canned drinks, banana, potato, chicken breast, cooked grains)
- Added cooked-weight default instruction to system prompt ensuring grains and pasta quantities match user expectations
- Added conservative estimation guidance for vague quantities like "a bowl" or "some"

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand SERVING_SIZES and refine extractFoodItems system prompt** - `b9532dd` (feat)

## Files Created/Modified
- `app/lib/food.ts` - SERVING_SIZES expanded to 17 entries; extractFoodItems system prompt updated with cooked-weight and vague-quantity instructions

## Decisions Made
- Cooked-weight instruction is placed immediately after the SERVING_SIZES interpolation block so it follows the reference table contextually in the LLM prompt
- No changes to JSON schema, model selection, or error handling — scope strictly limited to constant and prompt string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors exist in app/api/chat/route.ts, app/api/fasting/route.ts, and app/api/mcp/route.ts (implicit `any` parameter types). These are out of scope for this plan. `app/lib/food.ts` itself compiles with zero errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Common quantity estimates (1 cup, 1 slice, 1 shot, 1 can) now have explicit gram references in the LLM system prompt
- Grains and pasta will default to cooked weight, matching user intent
- Ready for Phase 04 plan 03

---
*Phase: 04-hardening-edge-cases*
*Completed: 2026-06-03*
