---
phase: 04-hardening-edge-cases
plan: 03
status: complete
commit: a35f5b6
files_modified:
  - app/lib/food.ts
---

# Plan 04-03 Summary: Per-Item USDA Error Isolation

## What was done

Added `usdaMatchSafe` helper to `app/lib/food.ts` that wraps `searchUSDA` in a try/catch. Any thrown error logs a `console.warn` and returns `null`, which routes the food item down the existing `usdaMatched=false` path rather than propagating to `Promise.all` and aborting the entire meal save.

Updated `logMeal` to call `usdaMatchSafe(food.name)` instead of bare `searchUSDA(food.name)`.

## Acceptance criteria verified

- TypeScript compiles with zero errors
- `usdaMatchSafe` appears 2 times in food.ts (definition + call site)
- `searchUSDA` appears exactly once in food.ts (inside `usdaMatchSafe` body)
- `logMeal` structure and `prisma.meal.create` shape unchanged

## Key decision

`usdaMatchSafe` is unexported — it is an internal guard, not a public API. The public contract (`logMeal` throws only `NoFoodItemsError`) is unchanged.
