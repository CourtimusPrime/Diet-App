# Phase 1: Logging Core - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end meal logging flow: user types a natural language description of what they ate → LLM parses into individual food items with quantities → parallel USDA FoodData Central lookups → wide-column PostgreSQL write via Prisma → chat UI displays collapsible food cards with macro data per item. Phase delivers the complete logging pipeline from input to persisted nutritional record.

</domain>

<decisions>
## Implementation Decisions

### OpenRouter Model & Parsing Strategy
- Use `google/gemini-flash-2.0` via OpenRouter for food parsing — fastest, cheapest, good structured JSON output
- Structured JSON response format for food extraction (tool_use / response_format schema enforcement)
- Streaming enabled — show typing indicator while pipeline runs, stream confirmation text to user
- Include common serving size table in system prompt (1 cup=240ml, 1 tbsp=15g, 1 oz=28g, etc.) for quantity normalization

### Chat UI Layout & Theming
- Zinc/slate dark theme: `zinc-900` background, `zinc-800` card surfaces, `zinc-700` borders
- Food cards collapsed by default — name + USDA match dot + kcal + 3 macro pills visible
- Macro pills: Protein (blue chip), Carbs (amber chip), Fat (red chip) — coloured for fast scanning
- Fixed bottom input area, full-width, rounded textarea with send icon button (Enter to submit, Shift+Enter newline)

### USDA Integration & Error Handling
- Search strategy: append `" raw"` to LLM food name for Foundation Foods preference; retry without suffix if zero results
- Fetch top 5 USDA results, select highest-priority dataType: Foundation Foods > SR Legacy > Survey (FNDDS) > Branded
- Zero results: store FoodItem with null nutrient columns, set `usdaMatched=false`, grey dot in UI — never block the meal save
- Parallel USDA lookups (Promise.all) — all items look up simultaneously for speed

### Prisma Schema & DB Setup
- `prisma db push` for dev iteration; switch to `prisma migrate dev` before production
- `String @id @default(cuid())` for all model IDs — URL-safe, collision-resistant
- UTC timestamps (`createdAt DateTime @default(now())`), convert to local time in UI display
- `usdaFdcId Int?` on FoodItem — USDA FDC IDs are integers, nullable for unmatched items

### Claude's Discretion
- Specific UI colour hex values within the zinc/slate palette
- Exact CSS class composition and component file structure
- Error message copy for unmatched foods and API failures
- TypeScript interface names and module organization within `app/lib/`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- Next.js 14 App Router conventions apply: `app/` directory, Server Components by default, `'use client'` for interactive components
- Prisma with PostgreSQL: standard `prisma/schema.prisma` + `app/lib/prisma.ts` singleton pattern
- OpenRouter API: `https://openrouter.ai/api/v1` base URL, OpenAI-compatible SDK interface

### Integration Points
- `app/api/chat/route.ts` — POST handler, main pipeline entry point
- `prisma/schema.prisma` — Meal, FoodItem (wide-column), DailyTarget models
- `app/lib/usda.ts` — NUTRIENT_ID_TO_COLUMN map + USDA fetch helpers
- `app/components/ChatInterface.tsx` — client component, message state, FoodCard rendering

</code_context>

<specifics>
## Specific Ideas

- Brief specifies exactly 103 nutrient columns on FoodItem — spanning energy, macros, minerals, vitamins, amino acids, fatty acids, bioactives
- USDA DEMO_KEY used for dev (30 req/hr); production uses registered free key (1,000 req/hr)
- Confirmation message after logging should be friendly and summarize what was logged (LLM-generated, not templated)
- Green dot = USDA matched, grey dot = no match — visible on collapsed card without expanding

</specifics>

<deferred>
## Deferred Ideas

- Rate limit detection and graceful degradation — deferred to Phase 4 (Hardening)
- Nutrient ID disambiguation across Foundation vs SR Legacy datasets — deferred to Phase 4
- MCP query tools — deferred to Phase 2

</deferred>
