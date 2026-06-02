# Requirements: NutriLog

## Overview

NutriLog must reliably parse natural language food descriptions, match them to USDA nutrient data,
and persist complete nutritional records that can be queried through an MCP server. Success means
logging a meal in one message and being able to ask Claude.ai "what nutrients am I low on this
week?" and receive an accurate, data-backed answer.

## Requirement Groups

### Intake Parsing (PARSE)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| PARSE-01 | User can describe a meal in plain language and have it split into individual food items | Must Have | ⬜ Not Started | Phase 1 |
| PARSE-02 | System normalises quantities to grams for USDA scaling (with display unit preserved) | Must Have | ⬜ Not Started | Phase 1 |
| PARSE-03 | LLM uses searchable USDA-friendly food names (e.g. "apple raw" not "apple") | Must Have | ⬜ Not Started | Phase 1 |
| PARSE-04 | System returns a friendly LLM-generated confirmation message after logging | Must Have | ⬜ Not Started | Phase 1 |

### USDA Nutrient Lookup (USDA)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| USDA-01 | System queries USDA FoodData Central for each parsed food item | Must Have | ⬜ Not Started | Phase 1 |
| USDA-02 | System prefers Foundation Foods > SR Legacy > Branded data for coverage depth | Must Have | ⬜ Not Started | Phase 1 |
| USDA-03 | Nutrient values are scaled from per-100g to actual consumed quantity before storage | Must Have | ⬜ Not Started | Phase 1 |
| USDA-04 | USDA FDC ID and official description are stored alongside parsed name | Should Have | ⬜ Not Started | Phase 1 |
| USDA-05 | System stores 103 distinct nutrient values across energy, macros, minerals, vitamins, amino acids, fatty acids, and bioactives | Must Have | ⬜ Not Started | Phase 1 |

### Data Persistence (DB)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| DB-01 | Meal, FoodItem, and DailyTarget models persisted to Railway PostgreSQL via Prisma | Must Have | ⬜ Not Started | Phase 1 |
| DB-02 | FoodItem has one typed `Float?` column per nutrient (wide-column schema, not EAV) | Must Have | ⬜ Not Started | Phase 1 |
| DB-03 | Deleting a Meal cascades to its FoodItems | Must Have | ⬜ Not Started | Phase 1 |
| DB-04 | DailyTarget stores column name, human label, target amount, and unit | Must Have | ⬜ Not Started | Phase 2 |

### Chat UI (UI)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| UI-01 | Mobile-first chat interface for logging food intake | Must Have | ⬜ Not Started | Phase 1 |
| UI-02 | Each logged food item displayed as a collapsible card with KCAL, protein, carbs, fat | Must Have | ⬜ Not Started | Phase 1 |
| UI-03 | USDA match status indicated (green dot = matched, grey = unmatched) | Should Have | ⬜ Not Started | Phase 1 |
| UI-04 | Typing indicator shown while API call is in progress | Should Have | ⬜ Not Started | Phase 1 |
| UI-05 | Enter key submits message (Shift+Enter for newline) | Must Have | ⬜ Not Started | Phase 1 |

### MCP Server (MCP)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| MCP-01 | MCP server exposes `get_meals_today` — full meal + food item + nutrient data for a given day | Must Have | ⬜ Not Started | Phase 2 |
| MCP-02 | MCP server exposes `get_nutrient_totals` — all non-zero nutrient column sums for a day | Must Have | ⬜ Not Started | Phase 2 |
| MCP-03 | MCP server exposes `get_remaining_targets` — consumed vs target with % complete per nutrient | Must Have | ⬜ Not Started | Phase 2 |
| MCP-04 | MCP server exposes `get_nutrient_history` — daily totals for selected nutrients over a date range | Must Have | ⬜ Not Started | Phase 2 |
| MCP-05 | MCP server exposes `get_deficiencies` — nutrients where average % of target is below threshold over a range | Must Have | ⬜ Not Started | Phase 2 |
| MCP-06 | MCP server exposes `get_recent_meals` and `get_meals_range` | Should Have | ⬜ Not Started | Phase 2 |
| MCP-07 | MCP server exposes `set_daily_target` — upsert a nutrient target by column name | Must Have | ⬜ Not Started | Phase 2 |
| MCP-08 | MCP server exposes `list_nutrient_columns` — self-documenting column reference by category | Should Have | ⬜ Not Started | Phase 2 |
| MCP-09 | MCP server connects to Railway PostgreSQL via `DATABASE_URL` env var | Must Have | ⬜ Not Started | Phase 2 |

### Deployment (DEPLOY)

| ID | Requirement | Priority | Status | Phase |
|----|-------------|----------|--------|-------|
| DEPLOY-01 | App deploys to Railway with `prisma migrate deploy && next start` start command | Must Have | ⬜ Not Started | Phase 3 |
| DEPLOY-02 | Environment variables documented in `.env.example` | Must Have | ⬜ Not Started | Phase 3 |
| DEPLOY-03 | MCP server builds to `dist/index.js` and is configured in Claude Desktop config | Must Have | ⬜ Not Started | Phase 3 |

## Priority Legend

- **Must Have**: Required for the app to function as intended
- **Should Have**: Improves polish or usability but not blocking
- **Nice to Have**: Desirable if time permits

## Traceability Notes

USDA-05 and DB-02 are tightly coupled — the 103-column schema is the implementation of capturing
all USDA nutrient IDs. If USDA coverage changes, both requirements update together. MCP-05
(deficiencies) depends on DB-04 (DailyTarget) being populated; the tool degrades gracefully with a
message when no targets are set.

## Phase Traceability

| Phase | Requirements |
|-------|-------------|
| Phase 1: Logging Core | PARSE-01, PARSE-02, PARSE-03, PARSE-04, USDA-01, USDA-02, USDA-03, USDA-04, USDA-05, DB-01, DB-02, DB-03, UI-01, UI-02, UI-03, UI-04, UI-05 |
| Phase 2: MCP Query Layer | DB-04, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09 |
| Phase 3: Production Deployment | DEPLOY-01, DEPLOY-02, DEPLOY-03 |
| Phase 4: Hardening & Edge Cases | PARSE-02 (refined), USDA-02 (refined), USDA-03 (refined) |
