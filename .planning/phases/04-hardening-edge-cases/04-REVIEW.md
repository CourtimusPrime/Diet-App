---
phase: 04-hardening-edge-cases
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - app/lib/usda.ts
  - app/lib/food.ts
  - .env.example
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 4 added four hardening features: per-nutrient deduplication in `nutrientsToColumns`, expanded `SERVING_SIZES`, a `usdaMatchSafe` isolation wrapper in `logMeal`, and rate-limit detection in `httpsGet`. All four features work at a basic level but contain meaningful defects: one critical logic bug (the first fetch error aborts both retry queries silently), one unverified model name, and several correctness and maintainability gaps that will cause silent data quality failures in production.

---

## Critical Issues

### CR-01: First-query network error suppresses the retry query entirely

**File:** `app/lib/usda.ts:242-245`

**Issue:** When the first query (`"<food> raw"`) hits a network-level error (timeout, DNS failure, TCP reset), the `catch` block immediately `return null`s. The second query — the plain food name fallback — is never attempted. This defeats the two-query retry design and causes a permanent `usdaMatched: false` record for any food that times out on one transient error. The docstring at line 208 claims "Returns null (never throws) if both queries return empty results or on fetch error" — but the word "both" is misleading: only one query is attempted before giving up.

The timeout path at line 19 calls `req.destroy(new Error(...))`, which fires `req.on('error', reject)` at line 18, which rejects the promise, which is caught at line 242 and returns null immediately. The second query is dead code on any network error.

**Fix:** Only `return null` early for rate-limit responses (which apply to the entire key/session). For transient network errors, `continue` to the next query instead of returning:

```typescript
} catch (err) {
  console.error(`[usda] Fetch error for query "${query}":`, err);
  continue; // try next query; return null only after all queries exhausted
}
```

---

## Warnings

### WR-01: DUPLICATE_NUTRIENT_IDS is exported but never consulted at runtime

**File:** `app/lib/usda.ts:191-195`

**Issue:** The `DUPLICATE_NUTRIENT_IDS` map is defined and exported as an audit record, but `nutrientsToColumns` never reads it. The deduplication logic (lines 270-278) emits the same `console.warn` for every duplicate, regardless of whether the ID is documented in the map. If a future nutrient ID is legitimately duplicated for a different reason, the map gives no operational guidance — it is purely decorative. More importantly, the comment block at line 186 states the map documents "WHY a given ID is flagged", implying callers should consult it; not doing so is a silent contract break.

**Fix:** Either remove the export and keep it as an inline comment, or make `nutrientsToColumns` use it to suppress the warn for known-benign duplicates:

```typescript
if (seenIds.has(nutrient.nutrientId)) {
  if (!DUPLICATE_NUTRIENT_IDS[nutrient.nutrientId]) {
    // Only warn for unexpected duplicates; known ones are documented
    console.warn('[usda] Unexpected duplicate nutrientId skipped:', nutrient.nutrientId);
  }
  continue;
}
```

---

### WR-02: Rate-limit detection uses 403 — conflates authorization failure with throttling

**File:** `app/lib/usda.ts:23`

**Issue:** `RATE_LIMIT_STATUS_CODES` includes `403 Forbidden`. USDA FDC returns `403` for an invalid or revoked API key, not only for rate limiting. Treating a bad key as a transient rate limit causes silent, permanent data loss: every meal logged while `USDA_API_KEY` is wrong will silently store `usdaMatched: false` with no actionable error message. The operator sees nutrient-free records and has no log entry indicating the key is the root cause — only a generic "Rate limit hit (HTTP 403)" message which suggests a temporary condition.

**Fix:** Separate the two cases. USDA FDC returns `429` for actual rate limits. `403` should be treated as a configuration error and logged at `error` level (not `warn`) with a specific message:

```typescript
if (data.statusCode === 429) {
  console.warn(`[usda] Rate limited (HTTP 429) for query "${query}" — storing with null nutrients`);
  return null;
}
if (data.statusCode === 403) {
  console.error('[usda] HTTP 403 — API key may be invalid or revoked. Check USDA_API_KEY.');
  return null;
}
```

---

### WR-03: `quantityG` from LLM is not validated before being passed to `nutrientsToColumns`

**File:** `app/lib/food.ts:123`

**Issue:** `food.quantityG` comes from an LLM JSON response parsed at line 83. While the JSON schema specifies `"type": "number"`, the LLM can return `0`, a negative number, or `Infinity`. Passing `0` or a negative value to `nutrientsToColumns` produces zero or negative nutrient values that are written directly to the database (`result[columnName] = (nutrient.value * quantityG) / 100`). A quantityG of `0` means every nutrient column stores `0` — a nutritionally incorrect but structurally valid row that will silently corrupt intake totals queried via MCP.

**Fix:** Add a guard in `logMeal` or at the top of `nutrientsToColumns`:

```typescript
// In logMeal, before building foodItemsData:
const validatedFoods = foods.filter(f => {
  if (!Number.isFinite(f.quantityG) || f.quantityG <= 0) {
    console.warn(`[food] Skipping "${f.name}" — invalid quantityG: ${f.quantityG}`);
    return false;
  }
  return true;
});
```

---

### WR-04: `Survey (FNDDS)` is in `DATA_TYPE_PRIORITY` but excluded from the API query filter

**File:** `app/lib/usda.ts:49, 221`

**Issue:** `DATA_TYPE_PRIORITY` at line 49 lists `'Survey (FNDDS)'` as third priority. However, the `dataType` filter sent to the USDA API at line 221 is `'Foundation,SR Legacy,Branded'` — Survey is omitted. The sort logic at lines 234-238 will therefore never encounter a Survey result in practice, making the Survey entry in `DATA_TYPE_PRIORITY` dead configuration. This is a coherence bug: either Survey should be added to the query filter, or removed from the priority array to avoid misleading future maintainers.

**Fix:** Either add `Survey (FNDDS)` to the query param to match the priority list, or explicitly remove it from `DATA_TYPE_PRIORITY` and add a comment explaining it was intentionally excluded:

```typescript
// If intentionally excluded:
export const DATA_TYPE_PRIORITY: string[] = [
  'Foundation',
  'SR Legacy',
  // Survey (FNDDS) excluded from query — lower nutrient coverage for this use case
  'Branded',
];
```

---

## Info

### IN-01: Model name `google/gemini-3.5-flash` does not exist on OpenRouter

**File:** `app/lib/food.ts:39`

**Issue:** The model identifier is `google/gemini-3.5-flash`. As of the knowledge cutoff, Google's model line is `gemini-2.0-flash` and `gemini-1.5-flash` — there is no `gemini-3.5-flash` release. The `.env.example` comment references `google/gemini-2.0-flash-001`. If OpenRouter rejects the model name, `extractFoodItems` silently returns `[]`, which causes `logMeal` to throw `NoFoodItemsError` for every input. This is a likely operational defect rather than a documentation slip.

**Fix:** Align the model string with the `.env.example` comment:

```typescript
model: 'google/gemini-2.0-flash-001',
```

---

### IN-02: `searchUSDA` is imported in `food.ts` but no longer called directly

**File:** `app/lib/food.ts:3`

**Issue:** `searchUSDA` is imported on line 3 and was the direct call site before the `usdaMatchSafe` wrapper was introduced. Now `usdaMatchSafe` calls `searchUSDA` internally, but `food.ts` still imports it by name. The import is technically needed because `usdaMatchSafe` calls it, but the named import in `food.ts` is the external surface — if `searchUSDA` were accidentally removed from the import, TypeScript would error. This is not a bug, but the import line gives a misleading impression that `food.ts` calls it directly. Minor clarity issue.

**Fix:** No change strictly required; the import is correct. Optionally add a comment:

```typescript
import { searchUSDA, nutrientsToColumns } from '@/app/lib/usda' // searchUSDA used via usdaMatchSafe
```

---

### IN-03: `httpsGet` chunks typed as `string` but `data` events emit `Buffer` by default

**File:** `app/lib/usda.ts:11`

**Issue:** The `data` event callback types the chunk as `string` (`chunk: string`). Node's `https` module emits `Buffer` objects by default unless `res.setEncoding('utf8')` is called. String concatenation (`data += chunk`) implicitly calls `.toString()` on each Buffer via JavaScript coercion, so this works correctly in practice, but the type annotation is inaccurate and could mislead future readers or cause issues if a linter enforces strict Buffer/string separation.

**Fix:**

```typescript
res.setEncoding('utf8');
res.on('data', (chunk: string) => { data += chunk; });
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
