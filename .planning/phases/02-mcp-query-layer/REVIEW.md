---
phase: 02-mcp-query-layer
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - mcp/server.ts
  - /home/court/.config/Claude/claude_desktop_config.json
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 02: MCP Query Layer — Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 2 (mcp/server.ts lines 135–222; ~/.config/Claude/claude_desktop_config.json)
**Status:** issues_found

## Summary

Reviewed the three new MCP tools added in Phase 2 (`get_remaining_targets`, `get_deficiencies`,
`get_nutrient_history`) and the Claude Desktop config entry. The core query logic is sound — the
80% threshold is applied correctly inline, `getDailyTotals` is used consistently, and `Promise.all`
is used appropriately for the parallel fetches in the first two tools.

Two real bugs exist: the `nutrients` filter in `get_nutrient_history` silently accepts invalid
column names and returns `0` without any indication of the error, and the `get_nutrient_history`
tool fires sequential (not parallel) DB calls — up to 30 round-trips — though this is a
correctness/reliability concern as much as a performance one since it holds the MCP connection
open for the full serial chain. One security finding: live credentials are duplicated in plaintext
in the Claude Desktop config.

---

## Critical Issues

### CR-01: Hardcoded production credentials in Claude Desktop config

**File:** `/home/court/.config/Claude/claude_desktop_config.json:7-8`
**Issue:** Both `DATABASE_URL` (with embedded password to the Railway PostgreSQL instance) and
`OPENROUTER_API_KEY` (live key) are stored in plaintext in the Claude Desktop preferences file.
This file is not in the git repo, but it is an unencrypted JSON file in a predictable path that:
- Gets synced by many cloud backup tools automatically
- Is readable by any process running as the same user
- Will be copied wholesale if the home directory is backed up or migrated
- Is the same credential pair already in `.env` — duplication increases the attack surface

The same secrets already exist in `.env` (which `.gitignore` protects). Bun auto-loads `.env`
when the working directory is the project root, but Claude Desktop launches the server without
a guaranteed cwd. The fix is to set the cwd explicitly in the config so bun can find `.env`.

**Fix:**
```json
{
  "mcpServers": {
    "nutrilog": {
      "command": "bun",
      "args": ["/home/court/dev/me/diet-app/mcp/server.ts"],
      "cwd": "/home/court/dev/me/diet-app"
    }
  }
}
```
With `cwd` set, bun will auto-load `.env` from the project root and both secrets can be removed
from the config. Bun 1.x loads `.env` automatically for any `bun run`/`bun <file>` invocation
when the file is found in the working directory.

---

## Warnings

### WR-01: `get_nutrient_history` silently accepts invalid nutrient column names

**File:** `mcp/server.ts:214`
**Issue:** When the `nutrients` parameter is provided, each key is used directly as a lookup into
`totals` with a `?? 0` fallback. `totals` is only populated for keys in `NUTRIENT_KEYS`
(initialized inside `getDailyTotals`), so any misspelled or unknown column name will silently
return `0` rather than an error. The AI tool caller receives what looks like valid data: a day's
worth of zeros for a nutrient that was never tracked — indistinguishable from "no intake logged".

Compare to `set_goal` (line 39–45) which validates the column name against `NUTRIENT_META` and
returns an explicit error for unknown names.

**Fix:** Validate each requested nutrient before executing the loop:

```typescript
async ({ date, days = 7, nutrients }) => {
  if (nutrients) {
    const invalid = nutrients.filter((k) => !NUTRIENT_META[k])
    if (invalid.length > 0) {
      return {
        content: [{ type: 'text' as const, text: `Unknown nutrient column(s): ${invalid.join(', ')}. Call list_nutrients to see valid names.` }],
        isError: true,
      }
    }
  }
  // ... rest of handler
```

---

### WR-02: `get_nutrient_history` runs up to 30 sequential DB queries

**File:** `mcp/server.ts:207-215`
**Issue:** The `for` loop `await`s `getDailyTotals(dateStr)` on each iteration. Each call to
`getDailyTotals` issues a `prisma.meal.findMany` with full `foodItems` include. For the maximum
`days=30`, this is 30 sequential round-trips to Railway over a proxy connection. The MCP stdio
connection has no timeout, but a slow or flaky network can stall the tool call for many seconds
and Claude Desktop will appear hung.

This is not merely a performance concern — it is a reliability concern. The other two Phase 2
tools (`get_remaining_targets`, `get_deficiencies`) correctly use `Promise.all` for parallel
fetches. This tool should follow the same pattern.

**Fix:** Fan out all day queries in parallel:

```typescript
const dates: string[] = []
for (let i = days - 1; i >= 0; i--) {
  const d = new Date(end)
  d.setDate(d.getDate() - i)
  dates.push(d.toISOString().slice(0, 10))
}

const dailyTotals = await Promise.all(dates.map((dateStr) => getDailyTotals(dateStr)))

const history = dates.map((dateStr, idx) => {
  const totals = dailyTotals[idx]
  return {
    date: dateStr,
    totals: nutrients ? Object.fromEntries(nutrients.map((k) => [k, totals[k] ?? 0])) : totals,
  }
})
```

---

## Info

### IN-01: `get_deficiencies` does not guard against `targetAmount = 0`

**File:** `mcp/server.ts:178`
**Issue:** The filter `(totals[t.columnName] ?? 0) < t.targetAmount * 0.8` treats a
`targetAmount` of `0` as `consumed < 0`, which is never true (consumed is always `>= 0`). So
zero-target goals are silently excluded from deficiencies. The `percent` field also returns `0`
for zero-target goals due to the guard at line 187. The end result is consistent (zero-target
goals are invisible to both tools), but `set_goal` does not validate `targetAmount > 0`, so
the schema allows a state that produces silently misleading output.

This is not a Phase 2 bug per se (the tool behaves correctly for any goal set via `set_goal`
with a sensible value), but the absence of a min-value constraint in the Zod schema for
`set_goal` means this edge case can be reached.

**Fix (in `set_goal`):** Add `z.number().positive()` instead of bare `z.number()` on the
`targetAmount` field so zero and negative targets are rejected at the tool call boundary.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (adversarial code review)_
_Depth: standard_
