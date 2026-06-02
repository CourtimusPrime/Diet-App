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
- Use **Shadcn/ui** components throughout (Button, Card, Input, Badge, Collapsible, etc.)
- **System `prefers-color-scheme`** drives theme — light and dark both required; implement via `next-themes` with `defaultTheme="system"` 
- Food cards collapsed by default — name + USDA match dot + kcal + 3 macro pills (Shadcn Badge) visible
- Macro pills: Protein (blue badge), Carbs (amber badge), Fat (red badge) — coloured for fast scanning
- Fixed bottom input area, full-width, Shadcn Textarea with send icon Button (Enter to submit, Shift+Enter newline)
- Shadcn Collapsible for expanding food cards to show full nutrient breakdown
- Use **Lucide icons** (`lucide-react`) for all iconography — no other icon libraries

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
- Specific Shadcn variant/size choices per component
- Exact CSS class composition within Tailwind + Shadcn conventions
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
- **DATABASE_URL** is set in `.env` pointing to Railway PostgreSQL — run `prisma db push` after schema is written to create tables
- Shadcn/ui: initialize with `npx shadcn@latest init` using New York style preset

</specifics>

<deferred>
## Deferred Ideas

- Rate limit detection and graceful degradation — deferred to Phase 4 (Hardening)
- Nutrient ID disambiguation across Foundation vs SR Legacy datasets — deferred to Phase 4
- MCP query tools — deferred to Phase 2

</deferred>
