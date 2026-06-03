# Phase 2: MCP Query Layer - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 4 (1 modified, 1 referenced read-only, 1 referenced read-only, 1 new config)
**Analogs found:** 3 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `mcp/server.ts` | service | request-response (MCP stdio) | `mcp/server.ts` lines 97-133 (`get_meals` tool) | exact — same file, same tool registration pattern |
| `lib/nutrientMeta.ts` | utility | CRUD (read-only) | `lib/nutrientMeta.ts` itself | n/a — reuse as-is, no modifications |
| `lib/goalStatus.ts` | utility | transform | `lib/goalStatus.ts` itself | n/a — reference only for threshold constant, do not call `goalStatus()` |
| `~/.config/Claude/claude_desktop_config.json` | config | n/a | none in codebase | no analog |

---

## Pattern Assignments

### `mcp/server.ts` — 3 new `server.tool()` calls (service, request-response)

**Analog:** `mcp/server.ts` — `get_meals` tool (lines 97-133) is the best in-file match because it uses: `localDateStr()` for date defaulting, a multi-param Zod schema with `.optional()`, date arithmetic with `.toISOString().slice(0, 10)`, a Prisma query with `orderBy`, and the standard return shape. The simpler tools (`get_daily_nutrition`, `get_goals`) are also valid references.

**Insertion point:** Add all 3 new `server.tool()` calls between line 133 and line 135 (before `const transport = new StdioServerTransport()`).

---

#### Imports pattern (lines 1-6) — already present, no new imports needed

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { prisma } from '@/app/lib/prisma'
import { NUTRIENT_META, NUTRIENT_KEYS, localDateStr, getDailyTotals } from '@/lib/nutrientMeta'
import { logMeal, NoFoodItemsError } from '@/app/lib/food'
```

No new imports are required. `getDailyTotals`, `localDateStr`, `NUTRIENT_META`, `prisma`, and `z` are all already imported. `goalStatus` must NOT be imported — the 80% threshold is applied inline.

---

#### Tool registration pattern — `server.tool()` call shape (line 10-19, simplest form)

```typescript
// Source: mcp/server.ts lines 10-19
server.tool(
  'get_daily_nutrition',
  'Get summed nutrient totals for a date. Returns all 103 nutrient values.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const totals = await getDailyTotals(d)
    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, totals }) }] }
  },
)
```

All tools follow: `server.tool(name, description, zodSchemaObject, asyncHandler)`. Return shape is always `{ content: [{ type: 'text' as const, text: JSON.stringify(result) }] }`.

---

#### Error return pattern (lines 39-44)

```typescript
// Source: mcp/server.ts lines 39-44 (set_goal unknown column check)
return {
  content: [{ type: 'text' as const, text: `Unknown column: ${columnName}. Call list_nutrients to see valid names.` }],
  isError: true,
}
```

For no-goals-set case (empty DailyTarget table), use a message field instead of `isError: true` — the empty state is not an error, just a guidance message. Pattern from `get_meals` which returns a result object with a `message` field when appropriate.

---

#### Date arithmetic + parallel fetch pattern (lines 104-116, `get_meals`)

```typescript
// Source: mcp/server.ts lines 104-116
async ({ date, days = 1 }) => {
  const endDate = localDateStr(date)
  const start = new Date(endDate)
  start.setDate(start.getDate() - (days - 1))
  // ...
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
```

For `get_nutrient_history`, adapt this date-walking pattern. Critical: use `d.toISOString().slice(0, 10)` to produce date strings, NOT locale-aware methods. `getDailyTotals()` uses UTC boundaries (`T00:00:00.000Z`) so date strings must be UTC-safe YYYY-MM-DD.

---

#### Prisma DailyTarget query pattern (lines 26-28, `get_goals`)

```typescript
// Source: mcp/server.ts lines 26-28
const rows = await prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } })
return { content: [{ type: 'text' as const, text: JSON.stringify(rows) }] }
```

`DailyTarget` fields available: `columnName`, `label`, `unit`, `targetAmount`, `createdAt`, `updatedAt`. For `get_remaining_targets` and `get_deficiencies`, use `Promise.all([getDailyTotals(d), prisma.dailyTarget.findMany()])` to run both fetches in parallel.

---

#### Multi-param Zod schema pattern (lines 101-103, `get_meals`)

```typescript
// Source: mcp/server.ts lines 101-103
{
  date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today'),
  days: z.number().int().min(1).max(30).optional().describe('Number of days back from `date` to include (e.g. 7 for the past week). Defaults to 1 (single day).'),
}
```

For `get_nutrient_history`, add a third param: `nutrients: z.array(z.string()).optional().describe('...')`. The `days` cap of `.max(30)` is a security requirement (DoS prevention) — replicate exactly.

---

#### Complete implementations to copy

**get_remaining_targets** — copy verbatim from RESEARCH.md Pattern 1 / Code Examples:

```typescript
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

**get_deficiencies** — threshold is `< 0.8` inline, NOT via `goalStatus()`:

```typescript
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

**get_nutrient_history** — loop getDailyTotals(), UTC-safe date strings:

```typescript
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

---

### `~/.config/Claude/claude_desktop_config.json` (config, n/a)

**Analog:** None in codebase. The file exists at `/home/court/.config/Claude/claude_desktop_config.json` (confirmed) with only a `preferences` key — no `mcpServers` key present.

**Current file structure** (line 1-57): Top-level object with a single `"preferences"` key. The `"mcpServers"` key must be added as a sibling to `"preferences"`.

**Config entry to add:**

```json
{
  "mcpServers": {
    "nutrilog": {
      "command": "bun",
      "args": ["/home/court/dev/me/diet-app/mcp/server.ts"],
      "env": {
        "DATABASE_URL": "<value from /home/court/dev/me/diet-app/.env>",
        "OPENROUTER_API_KEY": "<value from /home/court/dev/me/diet-app/.env>"
      }
    }
  },
  "preferences": { ... existing preferences object unchanged ... }
}
```

**Critical:** Use `"command": "bun"` — NOT `"npx"` with `"tsx"`. tsx is not installed on this machine. The package.json `"mcp": "bun mcp/server.ts"` script confirms bun is the correct runtime. The `args` array takes a single absolute path to `mcp/server.ts` — no `--project tsconfig.json` flag needed since bun reads root tsconfig automatically.

---

## Shared Patterns

### Standard MCP tool return shape
**Source:** `mcp/server.ts` lines 17, 27, 51, 61, 87, 131
**Apply to:** All 3 new tools
```typescript
return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
```
The `as const` on `'text'` is required — TypeScript narrows the literal type for the MCP SDK content discriminated union.

### Empty-state guidance pattern
**Source:** `mcp/server.ts` lines 39-44 (`set_goal` unknown column) — adapted for empty-table case
**Apply to:** `get_remaining_targets`, `get_deficiencies`
```typescript
if (targets.length === 0) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', targets: [] }) }],
  }
}
```
Note: use `targets: []` for get_remaining_targets and `deficiencies: []` for get_deficiencies in the empty-state payload, matching each tool's result key name.

### Date defaulting
**Source:** `lib/nutrientMeta.ts` lines 111-118
**Apply to:** All 3 new tools
```typescript
export function localDateStr(date?: string): string {
  if (date) return date
  const d = new Date()
  // ...returns YYYY-MM-DD for today (local time)
}
```
Always call `localDateStr(date)` as the first line of any date-accepting tool handler. Never call `new Date().toISOString().slice(0, 10)` directly — `localDateStr` handles both the default and the passthrough case.

### getDailyTotals() usage
**Source:** `lib/nutrientMeta.ts` lines 120-141; used in `mcp/server.ts` line 16
**Apply to:** All 3 new tools
```typescript
// Single day (get_remaining_targets, get_deficiencies):
const totals = await getDailyTotals(d)  // returns Record<string, number>, all 103 keys initialized to 0

// Multi-day (get_nutrient_history):
const dateStr = d.toISOString().slice(0, 10)  // UTC-safe date string
const totals = await getDailyTotals(dateStr)
```
`getDailyTotals()` always returns all 103 NUTRIENT_KEYS initialized to 0 — safe to access any key with `?? 0` but `?? 0` is still recommended for type safety.

### 80% deficiency threshold — inline, not via goalStatus()
**Source:** `lib/goalStatus.ts` line 6 — `goalStatus()` uses 0.95 for 'met', which is NOT 80%
**Apply to:** `get_deficiencies` only
```typescript
// CORRECT — use inline threshold:
.filter(t => (totals[t.columnName] ?? 0) < t.targetAmount * 0.8)

// WRONG — do not use:
// goalStatus(consumed, t.targetAmount) === 'partial'  // catches 0-95%, not 0-80%
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `~/.config/Claude/claude_desktop_config.json` | config | n/a | External Claude Desktop config; no MCP server config exists anywhere in the codebase to reference |

---

## Metadata

**Analog search scope:** `mcp/`, `lib/`, `app/lib/`, `~/.config/Claude/`
**Files scanned:** 4 (mcp/server.ts, lib/nutrientMeta.ts, lib/goalStatus.ts, ~/.config/Claude/claude_desktop_config.json)
**Pattern extraction date:** 2026-06-03
