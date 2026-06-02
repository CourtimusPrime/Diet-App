---
phase: 01-logging-core
plan: 03
subsystem: api-route
tags: [openrouter, llm, usda, prisma, sse, streaming, next-api-route]

requires:
  - 01-01  # prisma singleton at app/lib/prisma.ts; Meal/FoodItem schema
  - 01-02  # searchUSDA, nutrientsToColumns from app/lib/usda.ts
  - 01-05  # Next.js project bootstrap (next.config, tsconfig, package.json)

provides:
  - POST /api/chat handler: natural language → LLM parse → USDA lookup → DB write → SSE stream
  - extractFoodItems() helper (file-private): structured JSON extraction via OpenRouter
  - SSE protocol: { type:'meal', meal } chunk, then { type:'text', text } chunks, then [DONE]

affects:
  - 01-04 (ChatInterface.tsx consumes POST /api/chat SSE stream)
  - 02 (MCP server reads same Meal/FoodItem rows written here)

tech-stack:
  added: []
  patterns:
    - OpenRouter via openai SDK (baseURL: https://openrouter.ai/api/v1, OPENROUTER_API_KEY)
    - response_format json_schema strict mode for structured LLM extraction
    - ReadableStream + TextEncoder SSE pattern in Next.js App Router route handler
    - X-Accel-Buffering: no header for Railway proxy flush
    - Promise.all for parallel USDA lookups (one fetch per extracted food item)
    - Single prisma.meal.create with nested foodItems.create (atomic write)
    - Graceful usdaMatched=false path when USDA returns null (no throw, no crash)

key-files:
  created:
    - app/api/chat/route.ts
  modified: []

key-decisions:
  - "Import paths use @/app/lib/usda and @/app/lib/prisma (not @/lib/usda) — tsconfig @/* maps to project root, lib/ is under app/"
  - "Both tasks (extractFoodItems + POST handler) implemented in a single file write — atomically committed as 8035f95"
  - "TDD flag set in plan but no test framework present; TypeScript strict compilation serves as the type-safety gate"
  - "controller.error(err) called on catch in ReadableStream.start() — propagates error to Next.js response layer"
  - "Empty foods array returns a helpful user-facing text SSE chunk then [DONE] rather than an error response"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04, USDA-01, USDA-02, USDA-03, USDA-04, DB-01, DB-03]

duration: 8min
completed: 2026-06-02
---

# Phase 01 Plan 03: Chat API Route Summary

**POST /api/chat handler orchestrating LLM food parsing via OpenRouter json_schema, parallel USDA lookups, single Prisma nested write, and SSE streaming confirmation with X-Accel-Buffering: no for Railway**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Tasks:** 2
- **Files created:** 1

## Accomplishments

- `app/api/chat/route.ts` created — 222 lines, zero TypeScript errors
- `extractFoodItems()` uses `google/gemini-2.0-flash-001` via OpenRouter with `response_format: { type: 'json_schema', json_schema: { strict: true } }` — enforces `{ foods: [{ name, quantityG, quantityDisplay }] }` output shape
- SERVING_SIZES constant (1 cup, 1 tbsp, 1 tsp, 1 oz, 1 slice bread, 1 large egg, 1 medium apple) embedded in system prompt for quantity normalisation
- `POST` handler validates `{ message: string }` body — returns 400 on missing/non-string input
- Parallel USDA lookups via `Promise.all` — all food items search simultaneously
- Zero-result USDA path: FoodItem saved with `usdaMatched: false` and null nutrient columns — meal save is never blocked
- Single `prisma.meal.create` with nested `foodItems: { create: [...] }` — atomic write for meal + all food items
- First SSE chunk: `{ type: 'meal', meal }` with full Meal record including foodItems
- Second LLM call with `stream: true` generates friendly confirmation message streamed as `{ type: 'text', text }` chunks
- Stream terminates with `data: [DONE]`
- `X-Accel-Buffering: no` header on response prevents Railway Nginx proxy from buffering the SSE stream

## Task Commits

1. **Task 1 + Task 2: Full route implementation** - `8035f95` (feat) — both tasks implemented atomically in a single file write; single commit covers extractFoodItems() and POST handler

## Files Created/Modified

- `app/api/chat/route.ts` — Complete POST handler; imports OpenAI, prisma singleton, searchUSDA/nutrientsToColumns; exports POST; 222 lines

## Decisions Made

1. **Import path `@/app/lib/usda` not `@/lib/usda`** — tsconfig `"@/*": ["./*"]` maps to project root; `usda.ts` is at `app/lib/usda.ts`, so correct import is `@/app/lib/usda`. The 01-02 SUMMARY referenced `@/lib/usda` informally — corrected here.
2. **Both tasks in one commit** — `extractFoodItems` (Task 1) and `POST` handler (Task 2) are co-located in the same file. Writing them separately would have produced a broken file mid-task. Both tasks verified against their acceptance criteria before commit.
3. **TDD deviation** — Plan marks `tdd="true"` on both tasks. No Jest/Vitest framework is configured in the project. `npx tsc --noEmit --skipLibCheck` (zero errors) serves as the type-safety gate specified in each task's `<verify>` block. Integration testing requires a live OPENROUTER_API_KEY — documented in plan verification step 6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma generated client missing from worktree**
- **Found during:** TypeScript verification after writing route.ts
- **Issue:** `npx tsc --noEmit` failed with `Cannot find module '@/app/generated/prisma/client'` — the generated Prisma client exists in the main repo but is .gitignored and not present in the fresh worktree
- **Fix:** Ran `npx prisma generate` in the worktree to regenerate the client from the schema
- **Files modified:** app/generated/prisma/ (generated, not committed — gitignored)
- **Verification:** `npx tsc --noEmit --skipLibCheck` exits 0 after generation

### TDD Process Deviation

**2. [Context] TDD flag set; no test framework present**
- Both tasks have `tdd="true"` in the plan
- No Jest, Vitest, or other test runner is installed or configured in the project
- The plan's `<verify>` blocks only specify `npx tsc --noEmit --skipLibCheck`
- Resolution: TypeScript compilation (strict mode, zero errors) serves as the type-safety gate. Integration testing per plan verification step 6 requires a live OPENROUTER_API_KEY and is a user-run step documented in the plan.

## Known Stubs

None — `app/api/chat/route.ts` is fully wired:
- `extractFoodItems` makes a real OpenRouter API call (requires `OPENROUTER_API_KEY` in `.env`)
- `searchUSDA` / `nutrientsToColumns` are real implementations from 01-02
- `prisma.meal.create` writes to real Railway PostgreSQL

**User setup required:** Add `OPENROUTER_API_KEY=<your-key>` to `.env` before testing the route. `USDA_API_KEY` is optional — `DEMO_KEY` fallback applies (30 req/hr limit).

## Threat Flags

No new security surface beyond the plan's threat model. Verified mitigations:
- T-01-06 (prompt injection): `json_schema strict mode` constrains LLM output to `{ foods: [...] }`; LLM output is parsed with `JSON.parse` only, never eval'd or used in raw SQL; all DB writes go through Prisma parameterised queries
- T-01-07 (OPENROUTER_API_KEY disclosure): accessed only via `process.env.OPENROUTER_API_KEY!` in server-only route handler; Next.js never bundles server env vars into client JS
- T-01-08 (LLM confirmation as HTML): route emits plain text SSE chunks; rendering as HTML is a client concern (Plan 01-04 must use plain text rendering — noted)
- T-01-10 (raw error details in response): catch blocks call `console.error` (server-side) and `controller.error(err)` which Next.js converts to a stream error response — no stack traces in client output

## Self-Check

- [x] `app/api/chat/route.ts` exists at correct path
- [x] `git log --oneline` shows commit `8035f95`
- [x] `npx tsc --noEmit --skipLibCheck` exits 0 (zero errors)
- [x] `grep -c "export async function POST" app/api/chat/route.ts` = 1
- [x] `grep "gemini-2.0-flash-001" app/api/chat/route.ts` present (3 occurrences)
- [x] `grep "OPENROUTER_API_KEY" app/api/chat/route.ts` present
- [x] `grep "X-Accel-Buffering" app/api/chat/route.ts` present
- [x] `grep "Promise.all" app/api/chat/route.ts` present
- [x] `grep "usdaMatched: false" app/api/chat/route.ts` present
- [x] `grep "stream: true" app/api/chat/route.ts` present

## Self-Check Result

## Self-Check: PASSED

---
*Phase: 01-logging-core*
*Completed: 2026-06-02*
