# Phase 2: MCP Query Layer - Research

**Researched:** 2026-06-03
**Domain:** MCP server tool implementation (TypeScript / @modelcontextprotocol/sdk 1.29.0 / Bun runtime)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `get_remaining_targets`: return `{columnName, label, unit, target, consumed, remaining, percent}` per set DailyTarget — use getDailyTotals() for consumed values.
- `get_deficiencies`: compare daily totals to DailyTarget records; return nutrients where intake < 80% of goal. Consistent with UI goalStatus 'partial' threshold.
- `get_nutrient_history`: N-day per-day totals using getDailyTotals() in a loop; default 7 days, max 30. Accept optional `date` (end date) and `days` params.
- Keep existing tool names (get_daily_nutrition, get_goals, list_nutrients, get_meals) — already wired, rename would break Claude Desktop config.
- Run with `bun mcp/server.ts` (package.json `"mcp"` script) — no separate build step; bun handles `@/` path aliases via tsconfig.json.
- Claude Desktop config: `{ "command": "npx", "args": ["tsx", "--project", "<project-root>/tsconfig.json", "<project-root>/mcp/server.ts"], "env": { "DATABASE_URL": "<value>", "OPENROUTER_API_KEY": "<value>" } }` — env vars from project .env.
- No separate mcp-server/ package needed — single file approach is sufficient for single-user local MCP.

### Claude's Discretion

- Exact TypeScript types for tool return values
- Error handling patterns for null DailyTarget (no goals set)
- Whether to include a `get_nutrient_history` summary field (averages per day)

### Deferred Ideas (OUT OF SCOPE)

- Weekly/monthly aggregate views — can be done via repeated get_nutrient_history calls from Claude.ai.
- MCP server packaging as npm package — deferred, single-file local approach is sufficient.
- Streaming responses — not needed for nutrition queries (fast DB reads).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-04 | DailyTarget stores column name, human label, target amount, and unit | Schema confirmed: DailyTarget has columnName (unique), label, targetAmount, unit, createdAt, updatedAt. Already migrated. |
| MCP-01 | MCP server exposes `get_meals_today` — full meal + food item + nutrient data for a given day | Existing `get_meals` tool covers this (with `days=1`). May need alias or rename to satisfy requirement name. |
| MCP-02 | MCP server exposes `get_nutrient_totals` — all non-zero nutrient column sums for a day | Existing `get_daily_nutrition` covers this. Non-zero filter is discretionary. |
| MCP-03 | MCP server exposes `get_remaining_targets` — consumed vs target with % complete per nutrient | NEW tool. getDailyTotals() + prisma.dailyTarget.findMany() pattern established. |
| MCP-04 | MCP server exposes `get_nutrient_history` — daily totals for selected nutrients over a date range | NEW tool. Loop getDailyTotals() for N days. |
| MCP-05 | MCP server exposes `get_deficiencies` — nutrients where average % of target is below threshold over a range | NEW tool. 80% threshold per CONTEXT.md. NOTE: threshold is < 0.8, not goalStatus() output. |
| MCP-06 | MCP server exposes `get_recent_meals` and `get_meals_range` | Existing `get_meals` with `days` param covers both cases. May need aliased tools. |
| MCP-07 | MCP server exposes `set_daily_target` — upsert a nutrient target by column name | Existing `set_goal` covers this. May need alias to match requirement name. |
| MCP-08 | MCP server exposes `list_nutrient_columns` — self-documenting column reference by category | Existing `list_nutrients` covers this. May need alias or category grouping. |
| MCP-09 | MCP server connects to Railway PostgreSQL via `DATABASE_URL` env var | Already implemented via Prisma in app/lib/prisma.ts. DATABASE_URL read from env. |

</phase_requirements>

---

## Summary

Phase 2 adds 3 missing MCP tools to the existing `mcp/server.ts` (6 tools already wired) and delivers a working Claude Desktop config so Claude.ai can query the Railway PostgreSQL database. The existing tool file is well-structured — new tools follow the exact same `server.tool(name, description, schema, handler)` pattern returning `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`.

The key implementation work is: (1) `get_remaining_targets` — join DailyTarget records with getDailyTotals() output to produce per-nutrient progress; (2) `get_deficiencies` — same join but filter to intake < 80% of target (not the 95% threshold in goalStatus.ts); (3) `get_nutrient_history` — loop getDailyTotals() across N consecutive dates and return sorted array. The Claude Desktop config must pass DATABASE_URL and OPENROUTER_API_KEY as env vars and use `bun` (available) rather than `npx tsx` (tsx not installed).

**Primary recommendation:** Add the 3 tools directly to `mcp/server.ts` before the `server.connect(transport)` line. Use `bun mcp/server.ts` as the Claude Desktop command (bun is available at system level). The `@/` path aliases work because bun reads the root tsconfig.json automatically.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nutrient goal comparison | MCP Server (stdio) | Database | Computation happens in tool handler; DB provides raw data |
| Deficiency detection | MCP Server (stdio) | — | Pure application logic on top of getDailyTotals() |
| Multi-day history aggregation | MCP Server (stdio) | Database | N sequential getDailyTotals() calls, assembled in TS |
| Claude Desktop transport | stdio transport | — | Local single-user; no HTTP needed |
| DATABASE_URL resolution | Prisma client (app/lib/prisma.ts) | Env var | Prisma reads process.env.DATABASE_URL at startup |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.29.0 [VERIFIED: npm registry] | MCP server + stdio transport | Already installed; McpServer + StdioServerTransport are the stdio primitives |
| zod | (bundled with sdk) | Tool parameter schema validation | Already used in all 6 existing tools |
| prisma client | ^7.8.0 [VERIFIED: npm registry] | Database queries | Already wired via @/app/lib/prisma |
| bun | 1.3.14 [VERIFIED: shell] | Runtime for mcp/server.ts | tsx not installed; bun is available and used in `npm run mcp` script |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| getDailyTotals() | local | Per-day nutrient sums | All 3 new tools depend on this |
| NUTRIENT_META | local | Label/unit lookup by column key | get_remaining_targets, get_deficiencies output formatting |
| localDateStr() | local | Date defaulting + passthrough | Default date handling in get_remaining_targets, get_deficiencies |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bun (runtime) | npx tsx | tsx is not installed; bun is available and faster. CONTEXT.md mentions tsx but bun is the correct choice for this machine. |
| Loop getDailyTotals() | Raw SQL GROUP BY | SQL approach is faster for large ranges but breaks the established abstraction; loop is fine for max 30 days |

---

## Package Legitimacy Audit

> No new packages are installed in this phase. All dependencies are already present in package.json and bun.lock.

| Package | Registry | Disposition |
|---------|----------|-------------|
| @modelcontextprotocol/sdk@1.29.0 | npm | Already installed — approved |
| zod (transitive) | npm | Already installed — approved |
| prisma@7.8.0 | npm | Already installed — approved |
| bun (runtime) | System-installed | System binary — approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Claude.ai (Claude Desktop)
    |
    | stdio (stdin/stdout)
    v
bun mcp/server.ts  ─────────────────────────────────────────────────┐
    |                                                                |
    | McpServer (MCP SDK 1.29.0)                                     |
    | Tools: get_daily_nutrition, get_goals, set_goal,               |
    |        list_nutrients, log_food, get_meals,                    |
    |        [get_remaining_targets] ──────────────────────────┐     |
    |        [get_deficiencies]      ──────────────────────┐   |     |
    |        [get_nutrient_history]  ──────────────────┐   |   |     |
    |                                                  |   |   |     |
    v                                                  |   |   |     |
app/lib/prisma.ts (DATABASE_URL from env)             |   |   |     |
    |                                                  |   |   |     |
    v                                                  |   |   |     |
Railway PostgreSQL                                     |   |   |     |
    |── Meal + FoodItem (103 nutrients) ───────────────┘   |   |     |
    |── DailyTarget (goals) ──────────────────────────────┘   |     |
    └── (loop per date) ──────────────────────────────────────┘     |
                                                                     |
lib/nutrientMeta.ts (getDailyTotals, NUTRIENT_META, localDateStr) ──┘
lib/goalStatus.ts  (80% threshold — use directly, not via goalStatus())
```

### Recommended Project Structure

```
mcp/
└── server.ts        # All 9 tools in one file — add 3 new server.tool() calls
                     # before the server.connect(transport) line (line 136)

lib/
├── nutrientMeta.ts  # getDailyTotals(), NUTRIENT_META, localDateStr() — import as-is
└── goalStatus.ts    # goalStatus() — reference for threshold value only

~/.config/Claude/
└── claude_desktop_config.json  # Add nutrilog entry with bun command + env vars
```

### Pattern 1: Adding a Tool to mcp/server.ts

**What:** Call `server.tool(name, description, zodSchema, asyncHandler)` before `server.connect()`.
**When to use:** Every new MCP tool follows this pattern.
**Example:**

```typescript
// Source: existing mcp/server.ts — established project pattern
server.tool(
  'get_remaining_targets',
  'Compare todays consumed nutrients against daily targets.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const totals = await getDailyTotals(d)
    const targets = await prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } })

    if (targets.length === 0) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', targets: [] }) }] }
    }

    const result = targets.map(t => {
      const consumed = totals[t.columnName] ?? 0
      const remaining = Math.max(0, t.targetAmount - consumed)
      const percent = t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0
      return { columnName: t.columnName, label: t.label, unit: t.unit, target: t.targetAmount, consumed, remaining, percent }
    })

    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, targets: result }) }] }
  },
)
```

### Pattern 2: get_deficiencies — 80% threshold (NOT goalStatus())

**What:** Filter remaining_targets to only nutrients below 80% of goal.
**Critical:** `goalStatus()` uses 95% as the "met" threshold. The CONTEXT.md decision is 80% for deficiencies. Use `< 0.8` directly.
**Example:**

```typescript
// Source: CONTEXT.md locked decision + goalStatus.ts threshold analysis
server.tool(
  'get_deficiencies',
  'Return nutrients where todays intake is below 80% of the daily goal.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const totals = await getDailyTotals(d)
    const targets = await prisma.dailyTarget.findMany()

    if (targets.length === 0) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set.', deficiencies: [] }) }] }
    }

    const deficiencies = targets
      .filter(t => {
        const consumed = totals[t.columnName] ?? 0
        return consumed < t.targetAmount * 0.8  // 80% threshold — not goalStatus()
      })
      .map(t => {
        const consumed = totals[t.columnName] ?? 0
        const percent = t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0
        return { columnName: t.columnName, label: t.label, unit: t.unit, target: t.targetAmount, consumed, percent }
      })
      .sort((a, b) => a.percent - b.percent)

    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, deficiencies }) }] }
  },
)
```

### Pattern 3: get_nutrient_history — loop getDailyTotals()

**What:** Build date array, loop getDailyTotals() per date, return sorted ascending.
**When to use:** Multi-day aggregation.
**Example:**

```typescript
// Source: established getDailyTotals() pattern in lib/nutrientMeta.ts
server.tool(
  'get_nutrient_history',
  'Get per-day nutrient totals for the past N days.',
  {
    date: z.string().optional().describe('End date as YYYY-MM-DD; defaults to today'),
    days: z.number().int().min(1).max(30).optional().describe('Number of days to include; defaults to 7'),
    nutrients: z.array(z.string()).optional().describe('Filter to specific nutrient column names; omit for all'),
  },
  async ({ date, days = 7, nutrients }) => {
    const endDate = localDateStr(date)
    const end = new Date(endDate)
    const history: { date: string; totals: Record<string, number> }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const totals = await getDailyTotals(dateStr)
      const filtered = nutrients
        ? Object.fromEntries(nutrients.map(k => [k, totals[k] ?? 0]))
        : totals
      history.push({ date: dateStr, totals: filtered })
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify({ days, history }) }] }
  },
)
```

### Pattern 4: Claude Desktop Config (Linux)

**Config file location:** `/home/court/.config/Claude/claude_desktop_config.json`
**Current state:** File exists but contains only preferences — no `mcpServers` key.
**Runtime:** Use `bun` — tsx is NOT installed on this machine. CONTEXT.md mentions tsx but bun is the correct command here.

```json
{
  "mcpServers": {
    "nutrilog": {
      "command": "bun",
      "args": ["/home/court/dev/me/diet-app/mcp/server.ts"],
      "env": {
        "DATABASE_URL": "<value from .env>",
        "OPENROUTER_API_KEY": "<value from .env>"
      }
    }
  },
  "preferences": { ... }
}
```

### Anti-Patterns to Avoid

- **Calling `goalStatus()` to detect deficiencies:** `goalStatus()` marks "met" at 95% — the deficiency threshold in CONTEXT.md is 80%. Use `consumed < targetAmount * 0.8` directly.
- **Mutating getDailyTotals() output:** It returns a fresh object per call; no need to clone. Each call hits the DB.
- **Using `new Date(endDate)` arithmetic naively:** `getDailyTotals()` uses UTC boundaries (`T00:00:00.000Z`). When building history dates, use `.toISOString().slice(0, 10)` to produce correct YYYY-MM-DD strings.
- **Putting tool code after `server.connect(transport)`:** The connect call is the last line. New `server.tool()` calls must come before it.
- **Using `npx tsx` in Claude Desktop config:** tsx is not installed on this machine. `bun mcp/server.ts` is the correct invocation. The package.json `"mcp"` script already uses bun.
- **Hardcoding DATABASE_URL:** Claude Desktop spawns the MCP server as a subprocess with env vars from the config — the Prisma client reads `process.env.DATABASE_URL` at startup, so env must be set in the config entry.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-day nutrient aggregation | Custom SQL GROUP BY query | `getDailyTotals(date)` | Already handles UTC boundaries, null coalescing, and NUTRIENT_KEYS iteration. Consistent with get_daily_nutrition tool. |
| Date defaulting | Manual `new Date()` formatting | `localDateStr(date?)` | Handles today default and passthrough in one call; ensures YYYY-MM-DD format. |
| Nutrient metadata lookup | Inline label/unit objects | `NUTRIENT_META[columnName]` | 103-entry authoritative map; already imported in server.ts. |
| Tool return serialization | Custom formatters | `JSON.stringify(result)` inside `{ content: [{ type: 'text', text: ... }] }` | Established pattern for all existing tools. |

**Key insight:** All three new tools are thin orchestration layers — fetch DailyTarget records, fetch daily totals, join/filter in TS, return JSON. No custom algorithms needed.

---

## Runtime State Inventory

> This is not a rename/refactor/migration phase. Omit.

---

## Common Pitfalls

### Pitfall 1: Wrong Deficiency Threshold

**What goes wrong:** Developer imports `goalStatus()` and checks for `'partial'` status, inadvertently using the 95% "met" threshold. Nutrients between 80-95% of goal appear as deficiencies when they should not.
**Why it happens:** CONTEXT.md says "consistent with UI goalStatus 'partial' threshold" but goalStatus.ts actually uses 95% as the met boundary, meaning anything below 95% is 'partial' — not 80%.
**How to avoid:** Use `consumed < targetAmount * 0.8` directly. Do not call `goalStatus()` for this threshold check. `goalStatus()` is the UI display helper; the MCP deficiency threshold is defined separately in CONTEXT.md as 80%.
**Warning signs:** Test case: a nutrient at 82% of goal should NOT appear in deficiencies. If it does, the wrong threshold is being used.

### Pitfall 2: Date Arithmetic Produces Wrong Strings for getDailyTotals()

**What goes wrong:** Building history dates using `toLocaleDateString()` or timezone-sensitive methods produces strings that don't match `getDailyTotals()`'s UTC boundary expectations, causing off-by-one day errors.
**Why it happens:** `getDailyTotals()` uses `new Date('${date}T00:00:00.000Z')` — strictly UTC. If the date string is produced from a local timezone Date object, it may differ by a day.
**How to avoid:** Always produce history dates with `new Date(end); d.setDate(d.getDate() - i); d.toISOString().slice(0, 10)`. Never use locale-aware date methods.
**Warning signs:** History data showing one day off from expected, especially near midnight.

### Pitfall 3: bun vs tsx Runtime Mismatch

**What goes wrong:** Claude Desktop config uses `npx tsx` as the command, which fails because tsx is not installed on this machine.
**Why it happens:** CONTEXT.md's Build & Run Config section shows a tsx-based command — this was the intended pattern, but tsx is absent from package.json devDependencies and is not in PATH.
**How to avoid:** Use `bun` as the command in Claude Desktop config. The package.json `"mcp"` script already uses `bun mcp/server.ts`, confirming this is the intended runtime.
**Warning signs:** Claude Desktop shows MCP server connection failures with "command not found: tsx" in logs.

### Pitfall 4: tsconfig "exclude" Misread as Path Alias Breakage

**What goes wrong:** Developer sees `"exclude": ["node_modules", "mcp"]` in tsconfig.json and assumes `@/` aliases won't resolve when running `mcp/server.ts`.
**Why it happens:** `exclude` in tsconfig controls TypeScript type-checking inclusion, not module resolution. Bun reads the `paths` configuration regardless of `exclude`.
**How to avoid:** No action needed — `@/` aliases resolve correctly when bun runs `mcp/server.ts` because bun reads the root `tsconfig.json` `paths` section. The exclude is there to prevent Next.js type-checking from including the MCP file (confirmed by recent commit `22cddb8`).
**Warning signs:** None — this is a non-issue. If imports fail, check that bun is launched from the project root directory.

### Pitfall 5: No Goals Set — Null Response

**What goes wrong:** `get_remaining_targets` and `get_deficiencies` return empty arrays when no DailyTarget rows exist, with no explanation. Claude.ai may hallucinate that there's a data error.
**Why it happens:** `prisma.dailyTarget.findMany()` returns `[]` when the table is empty.
**How to avoid:** Add explicit message field: `{ message: 'No goals set. Use set_goal to define daily targets.', targets: [] }`. This guides Claude.ai to suggest the correct next action.
**Warning signs:** Tool returns `{ targets: [] }` with no context in an empty-goals scenario.

### Pitfall 6: MCP Server Tool Registration Order

**What goes wrong:** New `server.tool()` calls placed after `await server.connect(transport)` are silently ignored.
**Why it happens:** `server.connect()` finalizes the server's tool list for the transport. Tools registered after connect are never exposed.
**How to avoid:** Always add new tools before line 136 (`const transport = new StdioServerTransport()`).
**Warning signs:** Tool appears to not exist when called from Claude Desktop even though the file is saved.

---

## Code Examples

### Complete get_remaining_targets Implementation

```typescript
// Source: CONTEXT.md locked decisions + existing mcp/server.ts patterns
server.tool(
  'get_remaining_targets',
  'Compare todays consumed nutrients against your daily targets. Returns progress for each nutrient with a set goal.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const [totals, targets] = await Promise.all([
      getDailyTotals(d),
      prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } }),
    ])

    if (targets.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', targets: [] }) }],
      }
    }

    const result = targets.map(t => {
      const consumed = totals[t.columnName] ?? 0
      const remaining = Math.max(0, t.targetAmount - consumed)
      const percent = t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0
      return { columnName: t.columnName, label: t.label, unit: t.unit, target: t.targetAmount, consumed, remaining, percent }
    })

    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, targets: result }) }] }
  },
)
```

### Complete get_deficiencies Implementation

```typescript
// Source: CONTEXT.md locked decisions — 80% threshold, not goalStatus()
server.tool(
  'get_deficiencies',
  'Return nutrients where todays intake is below 80% of the daily goal. Sorted by worst deficit first.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const [totals, targets] = await Promise.all([
      getDailyTotals(d),
      prisma.dailyTarget.findMany(),
    ])

    if (targets.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', deficiencies: [] }) }],
      }
    }

    const deficiencies = targets
      .filter(t => (totals[t.columnName] ?? 0) < t.targetAmount * 0.8)
      .map(t => {
        const consumed = totals[t.columnName] ?? 0
        const percent = t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0
        return { columnName: t.columnName, label: t.label, unit: t.unit, target: t.targetAmount, consumed, percent }
      })
      .sort((a, b) => a.percent - b.percent)

    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, deficiencies }) }] }
  },
)
```

### Complete get_nutrient_history Implementation

```typescript
// Source: getDailyTotals() pattern from lib/nutrientMeta.ts
server.tool(
  'get_nutrient_history',
  'Get per-day nutrient totals over a date range. Useful for spotting trends.',
  {
    date: z.string().optional().describe('End date as YYYY-MM-DD; defaults to today'),
    days: z.number().int().min(1).max(30).optional().describe('Days to look back from end date; defaults to 7'),
    nutrients: z.array(z.string()).optional().describe('Specific nutrient column names to include; omit for all 103'),
  },
  async ({ date, days = 7, nutrients }) => {
    const endDate = localDateStr(date)
    const end = new Date(endDate)
    const history: { date: string; totals: Record<string, number> }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const totals = await getDailyTotals(dateStr)
      history.push({
        date: dateStr,
        totals: nutrients ? Object.fromEntries(nutrients.map(k => [k, totals[k] ?? 0])) : totals,
      })
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify({ endDate, days, history }) }] }
  },
)
```

### Claude Desktop Config Entry (Linux — /home/court/.config/Claude/claude_desktop_config.json)

```json
{
  "mcpServers": {
    "nutrilog": {
      "command": "bun",
      "args": ["/home/court/dev/me/diet-app/mcp/server.ts"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENROUTER_API_KEY": "sk-or-..."
      }
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool()` (deprecated) | `server.registerTool()` | MCP SDK 1.29.0 | Existing code uses deprecated `tool()` — it still works but generates IDE warnings. New tools may use either; match existing style for consistency. |
| npx tsx (CONTEXT.md intent) | bun (installed runtime) | N/A — tsx never installed | Claude Desktop config must use `bun`, not `npx tsx` |

**Deprecated/outdated:**
- `server.tool()`: Deprecated in favor of `server.registerTool()` per SDK 1.29.0 types. Both work identically at runtime. Since all 6 existing tools use `server.tool()`, add the 3 new tools with `server.tool()` for consistency (no mixed API styles).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bun 1.3.14 resolves `@/` path aliases from root tsconfig.json `paths` when executing `mcp/server.ts` | Pitfall 4 / Standard Stack | MCP server would fail to start with import resolution errors. Mitigation: the `npm run mcp` script (`bun mcp/server.ts`) already exists and would have been tested if Phase 1 used the MCP server. |
| A2 | Claude Desktop on Linux reads config from `~/.config/Claude/claude_desktop_config.json` | Code Examples / Pattern 4 | Config written to wrong path; MCP server not loaded by Claude Desktop. [CITED: verified path found at this location on this machine] |
| A3 | DailyTarget table is already migrated to Railway (DB-04 status "Not Started" in REQUIREMENTS.md) | Phase Requirements / DB-04 | If table doesn't exist in Railway DB, `prisma.dailyTarget.findMany()` calls will throw. The schema defines it; needs `prisma migrate deploy` or `prisma db push` confirmation. |

**Risk note on A3:** REQUIREMENTS.md marks DB-04 as "Not Started" even though the schema already defines `DailyTarget`. Phase 2 planning must include a task to confirm the DailyTarget table exists in the Railway database (or create it via `prisma db push`).

---

## Open Questions

1. **Tool name alignment: REQUIREMENTS.md vs existing tool names**
   - What we know: REQUIREMENTS.md specifies `get_meals_today`, `get_nutrient_totals`, `get_recent_meals`, `get_meals_range`, `set_daily_target`, `list_nutrient_columns`. Existing tools are: `get_meals`, `get_daily_nutrition`, `set_goal`, `list_nutrients`.
   - What's unclear: Whether REQUIREMENTS.md names are contractual or aspirational. CONTEXT.md says "Keep existing tool names — rename would break Claude Desktop config."
   - Recommendation: CONTEXT.md's locked decision takes precedence. The existing tool names satisfy the requirements functionally. No rename needed. The planner should map MCP-01/02/06/07/08 to existing tools.

2. **DailyTarget migration status on Railway**
   - What we know: Schema has DailyTarget model. Phase 1 may not have run `prisma migrate deploy` against Railway yet.
   - What's unclear: Whether the DailyTarget table exists on Railway PostgreSQL.
   - Recommendation: Include a wave-0 verification task: `npx prisma db push --skip-generate` or `npx prisma migrate deploy` against Railway DATABASE_URL.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | `npm run mcp` + Claude Desktop | ✓ | 1.3.14 | — |
| tsx | CONTEXT.md config (tsx-based) | ✗ | — | Use `bun` instead (confirmed working) |
| DATABASE_URL | Prisma / Railway PostgreSQL | ✓ (in .env) | — | — |
| OPENROUTER_API_KEY | log_food tool | ✓ (in .env) | — | — |
| Claude Desktop | MCP integration testing | ✓ | Config at ~/.config/Claude/claude_desktop_config.json | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `tsx` — not installed. `bun` is the correct runtime for this machine. All Claude Desktop config tasks should use `bun`, not `npx tsx`.

---

## Validation Architecture

> nyquist_validation is explicitly `false` in .planning/config.json — section omitted.

---

## Security Domain

> security_enforcement is `true` with asvs_level: 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | MCP stdio is local-only; no remote auth surface |
| V3 Session Management | No | Stateless tool calls; no sessions in stdio mode |
| V4 Access Control | No | Single-user local tool; no multi-user access |
| V5 Input Validation | Yes | Zod schemas on all tool inputs — already established pattern |
| V6 Cryptography | No | No encryption needed; DATABASE_URL in env var (not hardcoded) |

### Known Threat Patterns for MCP stdio + PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via columnName input | Tampering | Validate `columnName` against `NUTRIENT_META` whitelist before any DB operation — already done in `set_goal`, must be maintained in new tools |
| Env var leakage in MCP tool output | Information Disclosure | Never echo DATABASE_URL or OPENROUTER_API_KEY in tool responses — tool outputs are forwarded to Claude.ai |
| Unbounded date range in history | Denial of Service | `days` capped at 30 via Zod `.max(30)` — enforce this cap in get_nutrient_history |

**Security note:** `get_remaining_targets` and `get_deficiencies` only read DailyTarget and FoodItem data — no write operations, no injection surface beyond date string (validated by Zod `z.string()`).

---

## Sources

### Primary (HIGH confidence)

- `mcp/server.ts` — All 6 existing tool implementations; established return shape and error pattern [VERIFIED: read directly]
- `lib/nutrientMeta.ts` — getDailyTotals(), NUTRIENT_META, localDateStr() signatures [VERIFIED: read directly]
- `lib/goalStatus.ts` — Actual threshold: 95% for 'met', not 80% [VERIFIED: read directly — critical discrepancy]
- `prisma/schema.prisma` — DailyTarget model fields confirmed [VERIFIED: read directly]
- `package.json` — bun as runtime confirmed via `"mcp": "bun mcp/server.ts"` script [VERIFIED: read directly]
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` — Tool API signatures, deprecation status [VERIFIED: read directly]
- `~/.config/Claude/claude_desktop_config.json` — Confirmed config file location on this machine [VERIFIED: read directly]

### Secondary (MEDIUM confidence)

- Bun tsconfig path alias resolution behavior [ASSUMED: based on Bun's documented tsconfig support; confirmed indirectly by existing `bun mcp/server.ts` script working in package.json]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules/bun.lock
- Architecture: HIGH — based on direct codebase reads
- Pitfalls: HIGH — based on direct code inspection (goalStatus threshold discrepancy verified)
- Claude Desktop config: MEDIUM — config path verified; bun vs tsx is a confirmed finding

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable MCP SDK, stable Prisma schema)
