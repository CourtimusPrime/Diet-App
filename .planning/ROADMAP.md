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

- [x] **Phase 1: Logging Core** - Chat input → LLM parse → USDA lookup → food cards with macros (completed 2026-06-03)
- [x] **Phase 2: MCP Query Layer** - 9-tool MCP server connecting Claude.ai to Railway database (completed 2026-06-03)
- [x] **Phase 3: Production Deployment** - Railway deploy + Claude Desktop MCP integration live (completed 2026-06-03)
- [x] **Phase 03.1: Multi-User Support** - NextAuth v5, Google OAuth, per-user meal isolation, landing page (completed 2026-06-03)
- [ ] **Phase 03.2: Log Tab** - View today's food, delete entries, sort by Chronological/Protein/Fat/Carbs/Fiber (INSERTED)
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

- [x] 01-01-PLAN.md — Prisma schema (Meal, FoodItem 103-column, DailyTarget) + db push to Railway PostgreSQL
- [x] 01-02-PLAN.md — app/lib/usda.ts: NUTRIENT_ID_TO_COLUMN map, searchUSDA(), nutrientsToColumns()
- [x] 01-05-PLAN.md — Next.js project setup: npx create-next-app, shadcn init, next-themes, .env.example, all dependencies

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — app/api/chat/route.ts: extractFoodItems() LLM call, parallel USDA lookup, Prisma create, streaming SSE confirmation

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — app/components/ChatInterface.tsx: chat UI with FoodCard, typing indicator, Enter-to-send (honors UI-SPEC.md)

### Phase 2: MCP Query Layer

**Goal**: MCP server is running locally and all 9 tools return correct data from the Railway database
**Depends on**: Phase 1
**Requirements**: DB-04, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09
**Success Criteria** (what must be TRUE):

  1. `get_daily_nutrition` returns correct summed values for a day with multiple logged meals (verified against DB)
  2. `get_deficiencies` identifies a nutrient correctly flagged as below threshold when daily logged amount is under the set target
  3. `get_nutrient_history` returns one entry per day with correct per-day totals for the requested columns
  4. `set_goal` upserts a DailyTarget row and `get_remaining_targets` reflects it immediately
  5. `list_nutrients` returns all 103 column names with correct labels and units

**Plans**: 2 plans

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Add 3 missing tools to mcp/server.ts (get_remaining_targets, get_deficiencies, get_nutrient_history) + verify DailyTarget table in Railway

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Claude Desktop config: write mcpServers.nutrilog entry with bun command + env vars; verify all 9 tools load

### Phase 3: Production Deployment

**Goal**: App is live on Railway and MCP server is connected in Claude Desktop with real data flowing end-to-end
**Depends on**: Phase 2
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):

  1. Railway deployment succeeds and app is reachable at Railway URL with `next start -p ${PORT:-3000}`
  2. Logging a meal via the live URL creates a database record visible via MCP
  3. Claude Desktop can call `get_meals` and return real logged meals from the Railway database
  4. `.env.example` documents all required variables with descriptions

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Fix package.json PORT flag + packageManager field; create railway.json; create Railway project via dashboard

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Set env vars in Railway dashboard; trigger first deploy; verify live app logs a meal

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Verify .env.example completeness; end-to-end smoke test: log via Railway URL → query via Claude Desktop MCP

### Phase 03.1: Add multi-user support. This includes creating a landing page, an auth screen (email/password & 'Sign in with Google'), and state management. (INSERTED)

**Goal:** Add NextAuth.js v5 (email/password + Google OAuth), protect all app routes, isolate meals per user
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:

**Wave 1**

- [x] 03.1-01-PLAN.md — Package fix (next-auth@beta + bcryptjs), Prisma schema (User/Account/VerificationToken + Meal.userId), auth.config.ts + auth.ts + catch-all route + TypeScript augmentation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03.1-02-PLAN.md — middleware.ts (route protection + MCP exemption), Providers.tsx (SessionProvider), layout.tsx update, sign-in page, sign-up page, /api/auth/register endpoint

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03.1-03-PLAN.md — Wire userId into logMeal() + /api/chat + /api/diet, sign-out button in ChatInterface, .env.example auth vars, Railway deploy with auth env vars

### Phase 03.2: Log Tab (INSERTED)

**Goal:** Log tab showing today's food, with delete and sort (Chronological, Protein, Fat, Carbs, Fiber)
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05
**Depends on:** Phase 03.1
**Plans:** 3 plans

Plans:

**Wave 1** *(plans 01 and 02 are independent — run in parallel)*

- [ ] 03.2-01-PLAN.md — Install shadcn Skeleton and Sonner components (npx shadcn add skeleton && npx shadcn add sonner)
- [ ] 03.2-02-PLAN.md — Extract FoodCard to components/FoodCard.tsx (add mealId/onDelete props); wire ChatInterface onMealLogged callback; create GET /api/meals/today and DELETE /api/meals/[mealId] endpoints

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03.2-03-PLAN.md — Create TodayLog.tsx (fetch, sort pills, skeleton, empty state, optimistic delete + Sonner undo), LogTab.tsx (state coordinator), update app/page.tsx to render LogTab, add Toaster to app/layout.tsx

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

**Wave 1** *(all plans independent — run in parallel)*

- [ ] 04-01-PLAN.md — Audit NUTRIENT_ID_TO_COLUMN for duplicate IDs; add DUPLICATE_NUTRIENT_IDS constant + deduplication in nutrientsToColumns (usda.ts)
- [ ] 04-02-PLAN.md — Expand SERVING_SIZES with 10 new entries; refine extractFoodItems system prompt with cooked-weight default (food.ts)
- [ ] 04-03-PLAN.md — Add usdaMatchSafe() wrapper in food.ts; per-item USDA error isolation via try/catch in logMeal
- [ ] 04-04-PLAN.md — Rate-limit detection (HTTP 429/403) in httpsGet/searchUSDA; document USDA_API_KEY in .env.example

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Logging Core | 5/5 | Complete   | 2026-06-03 |
| 2. MCP Query Layer | 2/2 | Complete   | 2026-06-03 |
| 3. Production Deployment | 3/3 | Complete   | 2026-06-03 |
| 3.1. Multi-User Support | 3/3 | Complete   | 2026-06-03 |
| 3.2. Log Tab | 0/3 | Not started | - |
| 4. Hardening & Edge Cases | 0/4 | Not started | - |
