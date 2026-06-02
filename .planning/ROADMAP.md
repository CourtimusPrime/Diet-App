# Roadmap: NutriLog

## Overview

Four phases take NutriLog from zero to a hardened personal nutrition logger. Phase 1 builds the
complete logging pipeline — chat input, LLM parsing, USDA lookup, and food cards. Phase 2 adds the
MCP server so Claude.ai can query nutrient data. Phase 3 deploys the app to Railway and wires the
MCP into Claude Desktop. Phase 4 addresses known fragility points so the app is reliable for daily
use.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Logging Core** - Chat input → LLM parse → USDA lookup → food cards with macros
- [ ] **Phase 2: MCP Query Layer** - 8-tool MCP server connecting Claude.ai to Railway database
- [ ] **Phase 3: Production Deployment** - Railway deploy + Claude Desktop MCP integration live
- [ ] **Phase 4: Hardening & Edge Cases** - Duplicate nutrient IDs, rate limits, and unmatched foods handled gracefully

## Phase Details

### Phase 1: Logging Core

**Goal**: User can describe a meal in chat, have it parsed and USDA-matched, and see logged food cards with macro data
**Depends on**: Nothing (first phase)
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, USDA-01, USDA-02, USDA-03, USDA-04, USDA-05, DB-01, DB-02, DB-03, UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):

  1. Typing "I had 2 scrambled eggs, toast, and a coffee" creates one Meal row and three FoodItem rows in the database
  2. Each FoodItem has non-null values for at least energy_kcal, protein_g, carbohydrate_g, and fat_total_g when a USDA match is found
  3. Nutrient values are scaled to consumed quantity, not per-100g (e.g. 50g egg has ~half the per-100g values)
  4. The chat UI shows a collapsible food card per item with kcal and macros visible without expanding
  5. An unmatched food item (no USDA result) shows a grey dot and does not crash the flow

**Plans**: 5 plans
Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Prisma schema (Meal, FoodItem 103-column, DailyTarget) + db push to Railway PostgreSQL
- [ ] 01-02-PLAN.md — app/lib/usda.ts: NUTRIENT_ID_TO_COLUMN map, searchUSDA(), nutrientsToColumns()
- [x] 01-05-PLAN.md — Next.js project setup: npx create-next-app, shadcn init, next-themes, .env.example, all dependencies

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-03-PLAN.md — app/api/chat/route.ts: extractFoodItems() LLM call, parallel USDA lookup, Prisma create, streaming SSE confirmation

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — app/components/ChatInterface.tsx: chat UI with FoodCard, typing indicator, Enter-to-send (honors UI-SPEC.md)

### Phase 2: MCP Query Layer

**Goal**: MCP server is running locally and all 8 tools return correct data from the Railway database
**Depends on**: Phase 1
**Requirements**: DB-04, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09
**Success Criteria** (what must be TRUE):

  1. `get_nutrient_totals` returns correct summed values for a day with multiple logged meals (verified against DB)
  2. `get_deficiencies` identifies a nutrient correctly flagged as below threshold when daily logged amount is under the set target
  3. `get_nutrient_history` returns one entry per day with correct per-day totals for the requested columns
  4. `set_daily_target` upserts a DailyTarget row and `get_remaining_targets` reflects it immediately
  5. `list_nutrient_columns` returns all 103 column names with correct labels and units

**Plans**: 5 plans

Plans:

- [ ] 02-01: `mcp-server/src/index.ts` — McpServer scaffold, prisma client, dayRange() and aggregateNutrients() helpers
- [ ] 02-02: Implement get_meals_today, get_nutrient_totals, get_remaining_targets
- [ ] 02-03: Implement get_nutrient_history, get_deficiencies
- [ ] 02-04: Implement get_recent_meals, get_meals_range, set_daily_target, list_nutrient_columns
- [ ] 02-05: `mcp-server/package.json`, `tsconfig.json`; verify `npm run build` produces `dist/index.js`

### Phase 3: Production Deployment

**Goal**: App is live on Railway and MCP server is connected in Claude Desktop with real data flowing end-to-end
**Depends on**: Phase 2
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):

  1. Railway deployment succeeds with `prisma migrate deploy && next start` and app is reachable at Railway URL
  2. Logging a meal via the live URL creates a database record visible via MCP
  3. Claude Desktop can call `get_meals_today` and return real logged meals from the Railway database
  4. `.env.example` documents all required variables with descriptions

**Plans**: 4 plans

Plans:

- [ ] 03-01: `railway.json` deploy config; Railway project + PostgreSQL plugin setup
- [ ] 03-02: Set all env vars in Railway dashboard; trigger first deploy; verify migration runs
- [ ] 03-03: Build MCP server locally; add entry to `claude_desktop_config.json`; verify tool list loads in Claude
- [ ] 03-04: End-to-end smoke test: log meal via web → query via Claude Desktop MCP

### Phase 4: Hardening & Edge Cases

**Goal**: Known fragility points addressed so the app is reliable for daily use
**Depends on**: Phase 3
**Requirements**: PARSE-02 (refined), USDA-02 (refined), USDA-03 (refined)
**Success Criteria** (what must be TRUE):

  1. Ambiguous USDA nutrient IDs (e.g. 1278 appearing as both palmitoleic and EPA in different datasets) are handled without silent data overwrite
  2. Common quantity estimates (1 cup, 1 slice, 1 shot) produce gram values within 20% of standard references
  3. USDA DEMO_KEY rate limit (30 req/hr) is handled gracefully — items beyond limit are stored with null nutrients rather than erroring
  4. A food item with no USDA match stores name/quantity correctly and does not block the rest of the meal from being saved

**Plans**: 4 plans

Plans:

- [ ] 04-01: Audit NUTRIENT_ID_TO_COLUMN for duplicate IDs across Foundation Foods vs SR Legacy; add deduplication logic
- [ ] 04-02: Expand quantity estimation prompts; add common serving size reference in system prompt
- [ ] 04-03: Add per-item USDA error handling in chat route; partial success (some items matched, some not) should not throw
- [ ] 04-04: Add USDA_API_KEY env var reminder and rate-limit detection with graceful null fallback

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Logging Core | 1/5 | In Progress|  |
| 2. MCP Query Layer | 0/5 | Not started | - |
| 3. Production Deployment | 0/4 | Not started | - |
| 4. Hardening & Edge Cases | 0/4 | Not started | - |
