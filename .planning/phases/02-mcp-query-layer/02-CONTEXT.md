# Phase 2: MCP Query Layer - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP server (mcp/server.ts) already scaffolded with 6 tools. Phase 2 completes it by adding 3 missing tools (get_remaining_targets, get_deficiencies, get_nutrient_history) and delivering a working Claude Desktop config so Claude.ai can query nutrition data from the Railway database.

Current state: get_daily_nutrition, get_goals, set_goal, list_nutrients, log_food, get_meals all exist.
Missing: get_remaining_targets (goals vs intake comparison), get_deficiencies (below-threshold nutrients), get_nutrient_history (per-day multi-day totals).

</domain>

<decisions>
## Implementation Decisions

### Missing Tools

- `get_remaining_targets`: return `{columnName, label, unit, target, consumed, remaining, percent}` per set DailyTarget — shows goals vs current intake. Use getDailyTotals() for consumed values.
- `get_deficiencies`: compare daily totals to DailyTarget records; return nutrients where intake < 80% of goal — consistent with UI goalStatus 'partial' threshold.
- `get_nutrient_history`: N-day per-day totals using getDailyTotals() in a loop; default 7 days, max 30. Accept optional `date` (end date) and `days` params.
- Keep existing tool names (get_daily_nutrition, get_goals, list_nutrients, get_meals) — already wired, rename would break Claude Desktop config.

### Build & Run Config

- Run with `tsx mcp/server.ts` — no separate build step; tsx handles `@/` path aliases via tsconfig.json.
- Claude Desktop config: `{ "command": "npx", "args": ["tsx", "--project", "<project-root>/tsconfig.json", "<project-root>/mcp/server.ts"], "env": { "DATABASE_URL": "<value>", "OPENROUTER_API_KEY": "<value>" } }` — env vars from project .env.
- No separate mcp-server/ package needed — single file approach is sufficient for single-user local MCP.

### Claude's Discretion

- Exact TypeScript types for tool return values
- Error handling patterns for null DailyTarget (no goals set)
- Whether to include a `get_nutrient_history` summary field (averages per day)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `getDailyTotals(date: string): Promise<Record<string, number>>` in `lib/nutrientMeta.ts` — sums all FoodItem nutrients for a UTC day. Core helper for get_remaining_targets and get_nutrient_history.
- `localDateStr(date?: string): string` in `lib/nutrientMeta.ts` — YYYY-MM-DD today or passthrough. Use for default date handling.
- `NUTRIENT_META: Record<string, { label: string; unit: string }>` in `lib/nutrientMeta.ts` — 103 nutrient column metadata.
- `NUTRIENT_KEYS: string[]` in `lib/nutrientMeta.ts` — array of all 103 column names.
- `goalStatus(intake, goal)` in `lib/goalStatus.ts` — returns 'none'|'partial'|'met'|'over'; 80% threshold for 'partial'. Aligns with deficiency threshold.
- `prisma.dailyTarget.findMany()` — DailyTarget has: `columnName`, `targetAmount`, `label`, `unit`.

### Established Patterns

- All MCP tools return `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`.
- Error returns add `isError: true` to the return object.
- Import path aliases: `@/app/lib/prisma`, `@/lib/nutrientMeta`, `@/lib/goalStatus` all resolve via `@/ = ./` (project root).
- Date handling: UTC-based (`T00:00:00.000Z` / `T23:59:59.999Z`) via getDailyTotals.

### Integration Points

- `mcp/server.ts` — add 3 new `server.tool()` calls before the `server.connect(transport)` line.
- `lib/goalStatus.ts` — import `goalStatus` to check the 80% threshold consistently.
- Claude Desktop `claude_desktop_config.json` — add `nutrilog` server entry pointing to `npx tsx mcp/server.ts`.

</code_context>

<specifics>
## Specific Ideas

- Phase 2 success criteria require `get_remaining_targets` to "reflect immediately" after `set_goal` — both read from the same DailyTarget table, so this is automatic.
- `get_deficiencies` should only return nutrients where a DailyTarget exists AND intake < 80% of target — nutrients without goals should not appear as deficiencies.
- `get_nutrient_history` should return an array of `{date, totals}` objects sorted ascending by date.

</specifics>

<deferred>
## Deferred Ideas

- Weekly/monthly aggregate views — can be done via repeated get_nutrient_history calls from Claude.ai.
- MCP server packaging as npm package — deferred, single-file local approach is sufficient.
- Streaming responses — not needed for nutrition queries (fast DB reads).

</deferred>
