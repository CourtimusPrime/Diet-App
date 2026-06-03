---
phase: 04-hardening-edge-cases
plan: 04
status: complete
commit: c51dc10
files_modified:
  - app/lib/usda.ts
  - .env.example
---

# Plan 04-04 Summary: USDA Rate-Limit Detection

## What was done

**app/lib/usda.ts:**
- Changed `httpsGet` return type from `Promise<unknown>` to `Promise<{ statusCode: number; body: unknown }>`
- JSON parse failure in `httpsGet` now resolves with `{ statusCode, body: null }` instead of rejecting
- Added `RATE_LIMIT_STATUS_CODES: readonly number[] = [429, 403]`
- `searchUSDA` checks `data.statusCode` against `RATE_LIMIT_STATUS_CODES` and returns `null` with a warning immediately (exits the entire function, not just the loop iteration)
- Updated `data.foods` access to `(data.body as USDASearchResponse)?.foods`

**.env.example:**
- Updated `USDA_API_KEY` comment to reference `https://fdc.nal.usda.gov/api-guide`
- Added note: 30 req/hr without key, 3600 req/hr with registered key

## Acceptance criteria verified

- TypeScript compiles with zero errors
- `statusCode` appears 3+ times in usda.ts (return type, resolve call, RATE_LIMIT check)
- `RATE_LIMIT_STATUS_CODES` appears 2+ times (definition + usage)
- `429` in RATE_LIMIT_STATUS_CODES array
- "Rate limit" in console.warn message
- `searchUSDA` return type unchanged: `Promise<USDAFood | null>`
- `USDA_API_KEY` and `fdc.nal.usda.gov` both present in .env.example
