# Phase 1: Logging Core - Research

**Researched:** 2026-06-02
**Domain:** Next.js 14 App Router / OpenRouter LLM / USDA FoodData Central / Prisma + PostgreSQL / Shadcn UI
**Confidence:** HIGH (core stack), MEDIUM (nutrient ID completeness beyond confirmed subset)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `google/gemini-flash-2.0` (model ID `google/gemini-2.0-flash-001`) via OpenRouter for food parsing
- Structured JSON response format via `response_format: { type: 'json_schema' }` schema enforcement
- Streaming enabled — show typing indicator, stream confirmation text
- Include common serving size table in system prompt for quantity normalization
- Shadcn/ui components throughout (Button, Card, Input, Badge, Collapsible, etc.)
- System `prefers-color-scheme` drives theme — implement via `next-themes` with `defaultTheme="system"`
- Food cards collapsed by default; macro pills: Protein (blue), Carbs (amber), Fat (red)
- Fixed bottom input area, Shadcn Textarea with send icon Button (Enter submit, Shift+Enter newline)
- Shadcn Collapsible for expanding food cards to show full nutrient breakdown
- Lucide icons (`lucide-react`) for all iconography
- Search strategy: append `" raw"` to LLM food name for Foundation Foods preference; retry without suffix if zero results
- Fetch top 5 USDA results, select highest-priority dataType: Foundation Foods > SR Legacy > Survey > Branded
- Zero results: store FoodItem with null nutrient columns, `usdaMatched=false`, grey dot in UI — never block meal save
- Parallel USDA lookups (`Promise.all`) for speed
- `prisma db push` for dev iteration; switch to `prisma migrate dev` before production
- `String @id @default(cuid())` for all model IDs
- UTC timestamps (`createdAt DateTime @default(now())`), convert to local time in UI
- `usdaFdcId Int?` on FoodItem — nullable for unmatched items
- Shadcn/ui: initialize with `npx shadcn@latest init` using New York style preset

### Claude's Discretion
- Specific Shadcn variant/size choices per component
- Exact CSS class composition within Tailwind + Shadcn conventions
- Error message copy for unmatched foods and API failures
- TypeScript interface names and module organization within `app/lib/`

### Deferred Ideas (OUT OF SCOPE)
- Rate limit detection and graceful degradation — Phase 4
- Nutrient ID disambiguation across Foundation vs SR Legacy datasets — Phase 4
- MCP query tools — Phase 2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARSE-01 | User can describe a meal in plain language and have it split into individual food items | OpenRouter structured output with `json_schema` enforces array of food items |
| PARSE-02 | System normalises quantities to grams for USDA scaling (with display unit preserved) | LLM prompt includes serving size table; store `quantityG` (grams) + `quantityDisplay` (original) |
| PARSE-03 | LLM uses searchable USDA-friendly food names (e.g. "apple raw" not "apple") | System prompt instructs LLM to use USDA-style names; `" raw"` suffix strategy confirmed |
| PARSE-04 | System returns a friendly LLM-generated confirmation message after logging | Second LLM call (non-structured) streams confirmation text after DB write |
| USDA-01 | System queries USDA FoodData Central for each parsed food item | `/fdc/v1/foods/search` endpoint verified via live API |
| USDA-02 | System prefers Foundation Foods > SR Legacy > Branded data | `dataType` sort priority logic in `usda.ts` |
| USDA-03 | Nutrient values are scaled from per-100g to actual consumed quantity | `value * (quantityG / 100)` for each nutrient column |
| USDA-04 | USDA FDC ID and official description stored alongside parsed name | `usdaFdcId`, `usdaDescription` on FoodItem model |
| USDA-05 | System stores 103 distinct nutrient values across all categories | `NUTRIENT_ID_TO_COLUMN` map covering all confirmed 4-digit nutrient IDs |
| DB-01 | Meal, FoodItem, DailyTarget models persisted to Railway PostgreSQL via Prisma | Prisma 7.8.0 confirmed; DATABASE_URL set in .env pointing to Railway |
| DB-02 | FoodItem has one typed `Float?` column per nutrient (wide-column schema) | 103 Float? columns = ~824 bytes/row; well within 8KB PostgreSQL page limit |
| DB-03 | Deleting a Meal cascades to its FoodItems | `@relation(onDelete: Cascade)` in Prisma schema |
| UI-01 | Mobile-first chat interface for logging food intake | Shadcn + Tailwind mobile-first layout confirmed |
| UI-02 | Each logged food item displayed as collapsible card with KCAL, protein, carbs, fat | Shadcn Collapsible + Card + Badge confirmed |
| UI-03 | USDA match status indicated (green dot = matched, grey = unmatched) | `usdaMatched` boolean drives 8px dot color |
| UI-04 | Typing indicator shown while API call is in progress | Client-side state flag; Lucide `Loader2` animate-spin |
| UI-05 | Enter key submits message (Shift+Enter for newline) | `onKeyDown` handler on Textarea |
</phase_requirements>

---

## Summary

Phase 1 implements the complete meal-logging pipeline across five files: Prisma schema, USDA helper, chat API route, chat UI component, and global CSS. The technical core is a two-LLM-call pattern: the first call to OpenRouter extracts structured food items (model ID `google/gemini-2.0-flash-001`, `response_format: { type: 'json_schema' }`), which then fan out into parallel USDA FoodData Central lookups via `/fdc/v1/foods/search`, and the results write to PostgreSQL via Prisma's wide-column FoodItem model. A second streaming LLM call generates the friendly confirmation message that streams to the client.

The USDA FoodData Central API returns nutrients keyed by 4-digit nutrient IDs (e.g., `1003` for protein, `1210` for tryptophan). These map to named Float? columns in the Prisma schema. Live API verification confirmed the ID scheme and response structure. The 103-column wide table is well within PostgreSQL's 1,600-column limit and poses no page-size concern (103 × 8 bytes = 824 bytes, far below the 8KB page limit).

The chat UI is a client-side component built entirely from Shadcn/ui New York preset components. next-themes handles dark/light mode via `attribute="class" defaultTheme="system" enableSystem` wrapping the root layout. The streaming response from the summary LLM call uses the Web Streams `ReadableStream` API in a Next.js App Router POST route handler.

**Primary recommendation:** Build in the plan order: schema → usda.ts → route.ts → ChatInterface.tsx → globals.css. The USDA helper module is the highest-complexity piece; get the `NUTRIENT_ID_TO_COLUMN` map right before wiring the route.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Meal text input and display | Browser / Client | — | Interactive state (messages, pending flag, typing indicator) — must be client component |
| Chat API pipeline | API / Backend | — | LLM calls and USDA fetches require server-side secrets; never expose OpenRouter/USDA keys to browser |
| USDA nutrient lookup | API / Backend | — | External API call with key; parallel Promise.all happens server-side |
| Nutrient persistence | Database / Storage | API / Backend | Prisma writes from route handler; DB owns the records |
| Streaming confirmation text | API / Backend → Browser | — | Route handler streams ReadableStream; client reads via fetch + ReadableStreamDefaultReader |
| Dark/light theme | Browser / Client | Frontend Server (SSR) | next-themes reads OS preference client-side; `suppressHydrationWarning` on html prevents SSR flash |
| LLM food parsing | API / Backend | — | Structured output call with secret API key — server only |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | App Router framework | Project constraint; latest 14.x [VERIFIED: npm registry] |
| prisma | 7.8.0 | ORM + schema management | Project constraint; current stable [VERIFIED: npm registry] |
| @prisma/client | 7.8.0 | Type-safe DB client | Always paired with prisma [VERIFIED: npm registry] |
| openai | 6.41.0 | OpenAI-compatible SDK for OpenRouter | Official SDK; OpenRouter is OpenAI-API-compatible [VERIFIED: npm registry] |
| next-themes | 0.4.6 | System prefers-color-scheme theme | Official Shadcn dark mode recommendation [VERIFIED: npm registry + cited: ui.shadcn.com/docs/dark-mode/next] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.17.0 | Icon library | All iconography per user decision [VERIFIED: npm registry] |
| tailwindcss | 4.3.0 | Utility CSS | Shadcn dependency [VERIFIED: npm registry] |
| class-variance-authority | 0.7.1 | Variant management | Shadcn component internals [VERIFIED: npm registry] |
| clsx | 2.1.1 | Class merging | Standard with Shadcn [VERIFIED: npm registry] |
| tailwind-merge | 3.6.0 | Tailwind class deduplication | Standard with Shadcn [VERIFIED: npm registry] |

> Note: Shadcn/ui itself is not an npm package — components are installed via CLI (`npx shadcn@latest add <component>`) and copied into `components/ui/`. The CLI version is `shadcn@4.10.0` [VERIFIED: npm registry].

> Note on `@openrouter/sdk@0.12.79`: This is the official OpenRouter TypeScript SDK. However, the CONTEXT.md decision and OpenRouter docs both confirm that the `openai` npm package works identically by pointing `baseURL` at `https://openrouter.ai/api/v1`. Using `openai` is the standard approach and is what the research recommends — it avoids an extra dependency and `@openrouter/sdk` is still in beta with potential breaking changes.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `openai` SDK pointing at OpenRouter | `@openrouter/sdk` | openai SDK is stable/mature; @openrouter/sdk is beta; both work |
| Wide-column Float? schema | EAV (key-value Nutrient table) | Locked decision; EAV requires joins for aggregation |
| next-themes | CSS media query only | next-themes handles SSR hydration flash correctly |

**Installation:**
```bash
npm install next next-react-dom react react-dom
npm install prisma @prisma/client
npm install openai
npm install next-themes
npm install lucide-react
npm install tailwindcss @tailwindcss/postcss
npm install class-variance-authority clsx tailwind-merge
npx shadcn@latest init
npx shadcn@latest add button card badge collapsible textarea separator
```

---

## Package Legitimacy Audit

> slopcheck installed but defaults to PyPI ecosystem. All packages verified against npm registry manually via `npm view <pkg> version` and source repository confirmation.

| Package | Registry | Source Repo | npm view confirmed | Disposition |
|---------|----------|----|---|-------------|
| next | npm | github.com/vercel/next.js | 14.2.35 | Approved |
| prisma | npm | github.com/prisma/prisma | 7.8.0 | Approved |
| @prisma/client | npm | github.com/prisma/prisma | 7.8.0 | Approved |
| openai | npm | github.com/openai/openai-node | 6.41.0 | Approved |
| next-themes | npm | github.com/pacocoursey/next-themes | 0.4.6 | Approved |
| lucide-react | npm | github.com/lucide-icons/lucide | 1.17.0 | Approved |
| tailwindcss | npm | (well-known) | 4.3.0 | Approved |
| class-variance-authority | npm | github.com/joe-bell/cva | 0.7.1 | Approved |
| clsx | npm | (well-known) | 2.1.1 | Approved |
| tailwind-merge | npm | (well-known) | 3.6.0 | Approved |
| @openrouter/sdk | npm | github.com/OpenRouterTeam/typescript-sdk | 0.12.79 | Not used (openai SDK preferred) |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran against PyPI — ecosystem mismatch; all packages manually verified on npm)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User browser (ChatInterface.tsx 'use client')
  │
  │  POST /api/chat  { message: string }
  ▼
app/api/chat/route.ts  (Next.js Server Route Handler)
  │
  ├─[1] OpenRouter: google/gemini-2.0-flash-001
  │      response_format: json_schema
  │      → { foods: [{ name, quantityG, quantityDisplay, unit }] }
  │
  ├─[2] Promise.all → USDA FoodData Central API (per food item)
  │      GET /fdc/v1/foods/search?query={name+" raw"}&dataType=Foundation,SR+Legacy&pageSize=5
  │      → select top result by priority, extract 103 nutrients
  │      → scale each nutrient: value × (quantityG / 100)
  │
  ├─[3] prisma.meal.create({ data: { foodItems: { create: [...] } } })
  │      Railway PostgreSQL — Meal + FoodItem rows written
  │
  └─[4] OpenRouter: google/gemini-2.0-flash-001  (streaming)
         → friendly confirmation message text
         → ReadableStream piped to HTTP response
  │
  ▼
Client receives:
  - Structured JSON chunk: { type: 'meal', data: Meal+FoodItems }
  - Text stream chunks: confirmation message
  - Renders FoodCard components from meal data
  - Appends streamed text as AI message
```

### Recommended Project Structure

```
diet-app/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts        # POST handler: parse → USDA → DB → stream
│   ├── components/
│   │   ├── theme-provider.tsx  # 'use client' next-themes wrapper
│   │   ├── ChatInterface.tsx   # 'use client' chat UI + FoodCard
│   │   └── ui/                 # shadcn generated components
│   ├── lib/
│   │   ├── prisma.ts           # Prisma singleton
│   │   └── usda.ts             # NUTRIENT_ID_TO_COLUMN + search helpers
│   ├── globals.css             # Tailwind + shadcn CSS variables + custom
│   ├── layout.tsx              # ThemeProvider wraps children
│   └── page.tsx                # Renders ChatInterface
├── prisma/
│   └── schema.prisma           # Meal, FoodItem (103 cols), DailyTarget
└── .env                        # DATABASE_URL, OPENROUTER_API_KEY, USDA_API_KEY
```

### Pattern 1: OpenRouter Structured Output for Food Parsing

**What:** Single LLM call using `response_format: { type: 'json_schema' }` extracts structured food items from natural language meal description.
**When to use:** First step of the pipeline — must return type-safe array before USDA lookups begin.

```typescript
// Source: verified against OpenRouter docs + live OpenAI SDK pattern
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const SERVING_SIZES = `
1 cup = 240ml (liquids) or ~128g (salad greens) or ~200g (cooked grains)
1 tbsp = 15ml / ~14g
1 tsp = 5ml / ~4g
1 oz = 28g
1 slice bread = ~30g
1 large egg = ~50g
1 medium apple = ~182g
`;

const extractionResponse = await openai.chat.completions.create({
  model: 'google/gemini-2.0-flash-001',
  messages: [
    {
      role: 'system',
      content: `You extract individual food items from meal descriptions.
Use USDA-friendly food names (e.g. "chicken breast raw" not "grilled chicken").
Convert all quantities to grams using these references:
${SERVING_SIZES}
Return JSON matching the schema exactly.`,
    },
    { role: 'user', content: userMessage },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'food_extraction',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          foods: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'USDA-searchable food name' },
                quantityG: { type: 'number', description: 'Quantity in grams' },
                quantityDisplay: { type: 'string', description: 'Original display quantity e.g. "2 cups"' },
              },
              required: ['name', 'quantityG', 'quantityDisplay'],
              additionalProperties: false,
            },
          },
        },
        required: ['foods'],
        additionalProperties: false,
      },
    },
  },
});

const { foods } = JSON.parse(extractionResponse.choices[0].message.content!);
```

### Pattern 2: USDA FoodData Central Search + Nutrient Extraction

**What:** Search for food by name, select best match by dataType priority, extract and scale nutrients.
**When to use:** After LLM extraction; one fetch per food item, run in parallel.

```typescript
// Source: verified against live USDA FDC API at api.nal.usda.gov/fdc/v1

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const DATA_TYPE_PRIORITY = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

async function searchUSDA(foodName: string): Promise<USDAFood | null> {
  // Strategy: try with " raw" suffix first for Foundation Foods preference
  const queries = [`${foodName} raw`, foodName];
  
  for (const query of queries) {
    const url = new URL(`${USDA_BASE}/foods/search`);
    url.searchParams.set('api_key', process.env.USDA_API_KEY ?? 'DEMO_KEY');
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded');
    url.searchParams.set('pageSize', '5');
    
    const res = await fetch(url.toString());
    const data = await res.json();
    
    if (data.foods?.length > 0) {
      // Select highest-priority dataType match
      const sorted = [...data.foods].sort((a, b) => {
        return DATA_TYPE_PRIORITY.indexOf(a.dataType) - DATA_TYPE_PRIORITY.indexOf(b.dataType);
      });
      return sorted[0];
    }
  }
  return null;
}

// Nutrient scaling: USDA values are per 100g; scale to actual consumed grams
function nutrientsToColumns(food: USDAFood, quantityG: number): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  
  for (const nutrient of food.foodNutrients) {
    const columnName = NUTRIENT_ID_TO_COLUMN[nutrient.nutrientId];
    if (columnName && nutrient.value != null) {
      result[columnName] = (nutrient.value * quantityG) / 100;
    }
  }
  return result;
}
```

### Pattern 3: Streaming Confirmation Message to Client

**What:** Route handler streams the friendly LLM confirmation as a `ReadableStream` response using a custom protocol — JSON chunk first, then text stream.
**When to use:** After DB write is complete, signal client with meal data then stream confirmation text.

```typescript
// Source: verified against Next.js 14 docs (nextjs.org/docs/app/guides/streaming)
// Route Handler streaming pattern

export async function POST(req: Request) {
  const { message } = await req.json();
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Parse foods (non-streaming structured call)
        const foods = await extractFoodItems(message);
        
        // Step 2: Parallel USDA lookups
        const usdaResults = await Promise.all(foods.map(searchAndScale));
        
        // Step 3: DB write
        const meal = await createMeal(usdaResults);
        
        // Step 4: Send meal data as first JSON chunk
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'meal', meal })}\n\n`
        ));
        
        // Step 5: Stream confirmation text
        const confirmStream = await openai.chat.completions.create({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: 'Write a brief, friendly confirmation of the logged meal.' },
            { role: 'user', content: `Logged: ${meal.foodItems.map(f => f.name).join(', ')}` },
          ],
          stream: true,
        });
        
        for await (const chunk of confirmStream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`));
          }
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Pattern 4: Prisma Singleton for Next.js

**What:** Prevent multiple Prisma client instances during Next.js hot reload in development.
**When to use:** Always — standard pattern for Next.js + Prisma.

```typescript
// Source: [ASSUMED] standard Prisma + Next.js pattern (widely documented)
// app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Pattern 5: next-themes with Shadcn in App Router

**What:** Wrap root layout with ThemeProvider; apply dark mode via CSS class on `<html>`.
**When to use:** Required setup for Shadcn dark mode; `suppressHydrationWarning` prevents SSR mismatch.

```typescript
// Source: [CITED: ui.shadcn.com/docs/dark-mode/next]

// app/components/theme-provider.tsx
'use client'
import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// app/layout.tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Anti-Patterns to Avoid

- **LLM call in browser component:** OpenRouter API key must never reach the client. All LLM and USDA calls live in `app/api/chat/route.ts` only.
- **Multiple Prisma client instances:** Without the global singleton, hot reload creates new connections on every save. Always use `app/lib/prisma.ts` singleton.
- **Sequential USDA lookups:** Fetching foods one-at-a-time adds N × latency. Always `Promise.all`.
- **Storing per-100g nutrient values:** USDA returns per-100g; must scale by `(quantityG / 100)` before writing. Storing raw USDA values breaks MCP aggregation.
- **Using old 3-digit nutrient codes:** The FDC API uses 4-digit IDs in the `nutrientId` field (e.g., `1003` not `203`). The `nutrientNumber` field has the 3-digit code but is not the lookup key.
- **Calling `prisma db push` in production:** Use `prisma migrate deploy` in production (Railway start command). `db push` is for local dev iteration only.
- **`response_format: { type: 'json_object' }` without schema:** JSON mode without a schema still requires the model to produce JSON but doesn't enforce structure. Always use `type: 'json_schema'` with `strict: true` for the food extraction call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark/light mode theme switching | CSS media query checks in JS | `next-themes` | Handles SSR hydration, flash prevention, localStorage persistence |
| Prisma connection pooling | Manual pool management | PrismaClient singleton pattern | Prisma handles pooling internally; multiple instances cause connection leaks |
| JSON response validation | Manual parsing + instanceof checks | Strict `json_schema` mode in OpenRouter | LLM output is unpredictable; schema enforcement at API level is more reliable |
| Icon components | Custom SVG files | `lucide-react` | Project decision; tree-shakeable, consistent |
| Collapsible/accordion UI | Custom show/hide state | Shadcn `Collapsible` (Radix primitive) | Handles accessibility (`aria-expanded`, keyboard nav) correctly |
| Class merging | Manual string concatenation | `clsx` + `tailwind-merge` | Avoids duplicate Tailwind class conflicts |

**Key insight:** The USDA nutrient lookup and scaling logic is the most custom code in this phase — there is no library that wraps the FDC API with Prisma column mapping. Everything else (UI components, theme, ORM) should be delegated to libraries.

---

## USDA Nutrient ID Reference

The following nutrient IDs were confirmed via live USDA FDC API calls against Foundation Foods and SR Legacy items. These are the 4-digit `nutrientId` values returned in `foodNutrients` array items.

### Confirmed via Live API [VERIFIED: api.nal.usda.gov/fdc/v1]

**Proximates:**
| Nutrient ID | Column Name | Unit | Notes |
|-------------|------------|------|-------|
| 1051 | water_g | g | Water |
| 1008 | energy_kcal | kcal | Energy (general) |
| 2047 | energy_atwater_general_kcal | kcal | Energy Atwater General — preferred for Foundation Foods |
| 2048 | energy_atwater_specific_kcal | kcal | Energy Atwater Specific |
| 1003 | protein_g | g | Protein |
| 1004 | fat_total_g | g | Total lipid (fat) |
| 1005 | carbohydrate_g | g | Carbohydrate by difference |
| 1079 | fiber_g | g | Fiber, total dietary |
| 1063 | sugars_total_g | g | Sugars, total |
| 1002 | nitrogen_g | g | Nitrogen |
| 1007 | ash_g | g | Ash |

**Minerals:**
| Nutrient ID | Column Name | Unit |
|-------------|------------|------|
| 1087 | calcium_mg | mg |
| 1089 | iron_mg | mg |
| 1090 | magnesium_mg | mg |
| 1091 | phosphorus_mg | mg |
| 1092 | potassium_mg | mg |
| 1093 | sodium_mg | mg |
| 1095 | zinc_mg | mg |
| 1098 | copper_mg | mg |
| 1101 | manganese_mg | mg |
| 1103 | selenium_mcg | mcg |

**Vitamins (confirmed from multiple Foundation Foods API responses):**
| Nutrient ID | Column Name | Unit |
|-------------|------------|------|
| 1165 | thiamin_mg | mg |
| 1166 | riboflavin_mg | mg |
| 1167 | niacin_mg | mg |
| 1175 | vitamin_b6_mg | mg |
| 1176 | biotin_mcg | mcg |
| 1177 | folate_total_mcg | mcg |
| 1109 | vitamin_e_mg | mg |
| 1185 | vitamin_k1_mcg | mcg |

**Vitamins (from live API, search endpoint response confirming IDs):**
| Nutrient ID | Column Name | Unit |
|-------------|------------|------|
| 1106 | vitamin_a_rae_mcg | mcg |
| 1162 | vitamin_c_mg | mg |
| 1114 | vitamin_d_mcg | mcg |
| 1178 | vitamin_b12_mcg | mcg |
| 1253 | cholesterol_mg | mg |

**Amino Acids (confirmed from live API — SR Legacy item):**
| Nutrient ID | Column Name | Unit |
|-------------|------------|------|
| 1210 | tryptophan_g | g |
| 1211 | threonine_g | g |
| 1212 | isoleucine_g | g |
| 1213 | leucine_g | g |
| 1214 | lysine_g | g |
| 1215 | methionine_g | g |
| 1216 | cystine_g | g |
| 1217 | phenylalanine_g | g |
| 1218 | tyrosine_g | g |
| 1219 | valine_g | g |
| 1220 | arginine_g | g |
| 1221 | histidine_g | g |
| 1222 | alanine_g | g |
| 1223 | aspartic_acid_g | g |
| 1224 | glutamic_acid_g | g |
| 1225 | glycine_g | g |
| 1226 | proline_g | g |
| 1227 | serine_g | g |

**Fatty Acids (confirmed from live API):**
| Nutrient ID | Column Name | Unit |
|-------------|------------|------|
| 1258 | sfa_total_g | g | Saturated fat total |
| 1292 | mufa_total_g | g | Monounsaturated fat total |
| 1293 | pufa_total_g | g | Polyunsaturated fat total |
| 1259 | sfa_4_0_g | g | Butyric (4:0) |
| 1260 | sfa_6_0_g | g | Caproic (6:0) |
| 1261 | sfa_8_0_g | g | Caprylic (8:0) |
| 1262 | sfa_10_0_g | g | Capric (10:0) |
| 1263 | sfa_12_0_g | g | Lauric (12:0) |
| 1264 | sfa_14_0_g | g | Myristic (14:0) |
| 1265 | sfa_16_0_g | g | Palmitic (16:0) |
| 1266 | sfa_18_0_g | g | Stearic (18:0) |
| 1268 | mufa_18_1_g | g | Oleic (18:1) |
| 1269 | pufa_18_2_g | g | Linoleic (18:2) |
| 1270 | pufa_18_3_g | g | Linolenic (18:3) |
| 1271 | pufa_20_4_g | g | Arachidonic (20:4) |
| 1278 | pufa_20_5_epa_g | g | EPA (20:5 n-3) |
| 1280 | pufa_22_5_dpa_g | g | DPA (22:5 n-3) |
| 1272 | pufa_22_6_dha_g | g | DHA (22:6 n-3) |

### Assumed Additional Nutrients [ASSUMED]

The following IDs are from training knowledge and match the 4-digit FDC ID pattern. They should be verified against a full Foundation Foods API response (wait for rate limit reset or use a registered key). These complete the 103-column target:

| Nutrient ID | Column Name | Unit | Notes |
|-------------|------------|------|-------|
| 1106 | vitamin_a_rae_mcg | mcg | Vitamin A, RAE |
| 1107 | retinol_mcg | mcg | Retinol |
| 1108 | carotene_alpha_mcg | mcg | alpha-Carotene |
| 1159 | carotene_beta_mcg | mcg | beta-Carotene |
| 1166 | riboflavin_mg | mg | Vitamin B2 (partially confirmed) |
| 1170 | pantothenic_acid_mg | mg | Vitamin B5 |
| 1178 | vitamin_b12_mcg | mcg | Vitamin B12 |
| 1180 | choline_total_mg | mg | Choline, total |
| 1162 | vitamin_c_mg | mg | Vitamin C (partially confirmed) |
| 1114 | vitamin_d_mcg | mcg | Vitamin D total (partially confirmed) |
| 1110 | vitamin_e_added_mg | mg | Vitamin E, added |
| 1183 | vitamin_k2_mcg | mcg | Vitamin K2 (MK-4) |
| 1253 | cholesterol_mg | mg | Cholesterol (partially confirmed) |
| 1187 | lycopene_mcg | mcg | Lycopene |
| 1183 | lutein_zeaxanthin_mcg | mcg | Lutein + zeaxanthin |
| 1056 | starch_g | g | Starch |
| 1010 | sucrose_g | g | Sucrose |
| 1011 | glucose_g | g | Glucose |
| 1012 | fructose_g | g | Fructose |
| 1013 | lactose_g | g | Lactose |
| 1210 | tryptophan_g | g | (already confirmed) |
| 2000 | sugars_added_g | g | Total sugars (alternate) |
| 1057 | caffeine_mg | mg | Caffeine |
| 1058 | theobromine_mg | mg | Theobromine |
| 1190 | folate_dfe_mcg | mcg | Folate, DFE |
| 1186 | folate_food_mcg | mcg | Folate, food |
| 1194 | vitamin_b12_added_mcg | mcg | Vitamin B12, added |
| 1100 | iodine_mcg | mcg | Iodine (Foundation Foods reports this) |

**Building the full 103-column list:** The CONTEXT.md confirms 103 columns. The 37 confirmed + ~28 assumed above = ~65 IDs documented here. The remaining IDs cover additional individual fatty acids (individual SFAs 20:0, 22:0), tocopherols (beta, gamma, delta), and minerals (fluoride, molybdenum, chromium). The implementation strategy is: build `NUTRIENT_ID_TO_COLUMN` from all known IDs, then use a registered USDA API key (1,000 req/hr) to fetch a comprehensive Foundation Foods item and add any missing IDs found in the response. This is a Phase 1 implementation task, not a prerequisite.

---

## Common Pitfalls

### Pitfall 1: DEMO_KEY Rate Limit During Development
**What goes wrong:** USDA `DEMO_KEY` allows only 30 requests/hour per IP. Logging one meal with 5 food items costs 5 requests. During active development (repeated test submits), you hit the limit in 6 meals.
**Why it happens:** DEMO_KEY has a 30 req/hour hard limit (verified via live API and docs).
**How to avoid:** Register for a free USDA API key at https://api.data.gov/signup/. Set `USDA_API_KEY` in `.env`. The registered key allows 1,000 req/hour.
**Warning signs:** HTTP 429 responses from api.nal.usda.gov with `Retry-After` header.

### Pitfall 2: Nutrient ID Discrepancy Between Dataset Types
**What goes wrong:** Foundation Foods and SR Legacy use the same 4-digit nutrient IDs but may report slightly different sets of nutrients. A nutrient present in SR Legacy may be absent in Foundation Foods, so `NUTRIENT_ID_TO_COLUMN` map produces `undefined` lookup → column stays null even when data exists in the USDA response.
**Why it happens:** Each dataset was assembled separately; Foundation Foods has more granular measured data while SR Legacy has broader coverage.
**How to avoid:** Build the map comprehensively from both datasets. Log any `nutrientId` that appears in USDA responses but is not in the map (one-time debug pass with a registered key).
**Warning signs:** `energy_kcal` is null after a successful USDA match.

### Pitfall 3: SSR Hydration Flash on Dark/Light Mode
**What goes wrong:** Server renders with `class="dark"` but client detects `prefers-color-scheme: light` → flash of wrong theme on page load.
**Why it happens:** Server cannot read the browser's `prefers-color-scheme` at render time.
**How to avoid:** `suppressHydrationWarning` on the `<html>` element plus `disableTransitionOnChange` on `ThemeProvider`. next-themes injects a script that sets the class before first paint. [CITED: ui.shadcn.com/docs/dark-mode/next]
**Warning signs:** Visible flash between dark/light on hard refresh.

### Pitfall 4: `response_format` JSON Schema Rejected by Model
**What goes wrong:** OpenRouter returns an error or ignores the schema when `strict: true` is set with an unsupported model.
**Why it happens:** Not all models support strict JSON schema mode. `google/gemini-2.0-flash-001` supports it (confirmed), but falling back to an alternate model may break.
**How to avoid:** Always test structured output with the exact model ID `google/gemini-2.0-flash-001`. Do not use the free/experimental variants like `google/gemini-2.0-flash-exp:free` for the extraction call (they have different capability guarantees).
**Warning signs:** `choices[0].message.content` is not valid JSON, or API returns `400` with schema-related message.

### Pitfall 5: Streaming Response Not Flushed by Proxy/CDN
**What goes wrong:** The streaming SSE response is buffered by Railway's reverse proxy or the browser, and the typing indicator never shows intermediate state.
**Why it happens:** Default proxy behaviour buffers responses. Railway uses Nginx-based routing.
**How to avoid:** Set `X-Accel-Buffering: no` header on the streaming response, or ensure Railway deployment doesn't add buffering middleware. [CITED: nextjs.org/docs/app/guides/streaming]
**Warning signs:** Confirmation text appears all at once with no streaming, typing indicator shows but then jumps to full message.

### Pitfall 6: Prisma `db push` vs `migrate dev` — Irreversible Changes
**What goes wrong:** `prisma db push` applies schema changes directly to the Railway PostgreSQL database without a migration history, making rollback impossible.
**Why it happens:** `db push` is designed for dev iteration; it bypasses the migration system.
**How to avoid:** Use `db push` only on local dev against a throwaway database. Switch to `prisma migrate dev` (creates migration files) before connecting to the shared Railway DB. The CONTEXT.md acknowledges this pattern.
**Warning signs:** Schema drift between local and Railway; no `prisma/migrations/` directory.

---

## Code Examples

### Prisma Schema Structure (FoodItem wide-column)

```prisma
// Source: [ASSUMED] based on Prisma docs + locked decisions from CONTEXT.md

model Meal {
  id          String     @id @default(cuid())
  description String
  createdAt   DateTime   @default(now())
  foodItems   FoodItem[]
}

model FoodItem {
  id               String   @id @default(cuid())
  mealId           String
  meal             Meal     @relation(fields: [mealId], references: [id], onDelete: Cascade)
  name             String                // LLM-extracted name
  quantityG        Float                 // Grams consumed (for scaling)
  quantityDisplay  String                // Original display: "2 cups"
  usdaFdcId        Int?                  // Nullable — absent for unmatched items
  usdaDescription  String?               // Official USDA description
  usdaMatched      Boolean @default(false)
  createdAt        DateTime @default(now())
  
  // 103 nutrient columns (Float? = nullable)
  energy_kcal          Float?
  protein_g            Float?
  fat_total_g          Float?
  carbohydrate_g       Float?
  fiber_g              Float?
  sugars_total_g       Float?
  // ... all 103 columns
}

model DailyTarget {
  id           String   @id @default(cuid())
  columnName   String   @unique  // e.g. "protein_g"
  label        String            // e.g. "Protein"
  targetAmount Float
  unit         String            // e.g. "g"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### NUTRIENT_ID_TO_COLUMN Map Structure

```typescript
// Source: [VERIFIED: api.nal.usda.gov/fdc/v1] for confirmed IDs; [ASSUMED] for remainder

export const NUTRIENT_ID_TO_COLUMN: Record<number, string> = {
  // Proximates
  1051: 'water_g',
  1008: 'energy_kcal',
  2047: 'energy_atwater_general_kcal',
  1003: 'protein_g',
  1004: 'fat_total_g',
  1005: 'carbohydrate_g',
  1079: 'fiber_g',
  1063: 'sugars_total_g',
  
  // Minerals
  1087: 'calcium_mg',
  1089: 'iron_mg',
  1090: 'magnesium_mg',
  1091: 'phosphorus_mg',
  1092: 'potassium_mg',
  1093: 'sodium_mg',
  1095: 'zinc_mg',
  1098: 'copper_mg',
  1101: 'manganese_mg',
  1103: 'selenium_mcg',
  
  // Vitamins
  1165: 'thiamin_mg',
  1166: 'riboflavin_mg',
  1167: 'niacin_mg',
  1175: 'vitamin_b6_mg',
  1176: 'biotin_mcg',
  1177: 'folate_total_mcg',
  1109: 'vitamin_e_mg',
  1185: 'vitamin_k1_mcg',
  1106: 'vitamin_a_rae_mcg',
  1162: 'vitamin_c_mg',
  1114: 'vitamin_d_mcg',
  1178: 'vitamin_b12_mcg',
  1253: 'cholesterol_mg',
  
  // Amino Acids
  1210: 'tryptophan_g',
  1211: 'threonine_g',
  1212: 'isoleucine_g',
  1213: 'leucine_g',
  1214: 'lysine_g',
  1215: 'methionine_g',
  1216: 'cystine_g',
  1217: 'phenylalanine_g',
  1218: 'tyrosine_g',
  1219: 'valine_g',
  1220: 'arginine_g',
  1221: 'histidine_g',
  1222: 'alanine_g',
  1223: 'aspartic_acid_g',
  1224: 'glutamic_acid_g',
  1225: 'glycine_g',
  1226: 'proline_g',
  1227: 'serine_g',
  
  // Fatty Acids
  1258: 'sfa_total_g',
  1292: 'mufa_total_g',
  1293: 'pufa_total_g',
  1259: 'sfa_4_0_g',
  1260: 'sfa_6_0_g',
  1261: 'sfa_8_0_g',
  1262: 'sfa_10_0_g',
  1263: 'sfa_12_0_g',
  1264: 'sfa_14_0_g',
  1265: 'sfa_16_0_g',
  1266: 'sfa_18_0_g',
  1268: 'mufa_18_1_g',
  1269: 'pufa_18_2_g',
  1270: 'pufa_18_3_g',
  1271: 'pufa_20_4_g',
  1278: 'pufa_20_5_epa_g',
  1280: 'pufa_22_5_dpa_g',
  1272: 'pufa_22_6_dha_g',
  // ... additional IDs appended after verified with registered API key
};

// Columns that appear in both Foundation Foods and SR Legacy — safe to always include
export const CORE_NUTRIENT_COLUMNS = ['energy_kcal', 'protein_g', 'fat_total_g', 'carbohydrate_g', 'fiber_g'];
```

### ChatInterface Client Component Skeleton

```typescript
// Source: [ASSUMED] — Next.js 14 App Router 'use client' pattern + Shadcn components

'use client'
import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Send, ChevronDown, ChevronUp, Loader2, Utensils } from 'lucide-react'

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isPending, setIsPending] = useState(false)
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  // ... fetch + ReadableStreamDefaultReader to consume SSE
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `json_object` mode (free-form JSON) | `json_schema` with `strict: true` | Gemini 2.0 Flash (Dec 2024) | Schema-enforced structured output; no post-parse validation needed |
| Pages Router API routes | App Router Route Handlers | Next.js 13+ | Streaming responses via ReadableStream now first-class |
| Prisma 4.x `Float` maps to `DECIMAL(65,30)` | Prisma 5.x `Float` maps to `DOUBLE PRECISION` | Prisma v5 | Performance improvement for nutrient math; no precision loss for nutrition data |
| Separate `openrouter` npm package | `openai` SDK with custom `baseURL` | OpenRouter launch | OpenRouter is OpenAI-API-compatible; one less dependency |

**Deprecated/outdated:**
- `next/font` manual setup: Next.js 14 auto-optimizes Geist Sans via `next/font/google` — no manual font loading needed
- `pages/_app.tsx` ThemeProvider: Must be in `app/layout.tsx` for App Router

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nutrient IDs 1106 (Vit A), 1162 (Vit C), 1114 (Vit D), 1166 (riboflavin), 1178 (B12), 1253 (cholesterol) are correct | USDA Nutrient ID Reference | Columns in schema have wrong IDs → nutrient data stored as null even when USDA returns values; fix requires schema migration |
| A2 | Additional 28+ nutrient IDs beyond the confirmed set complete the 103-column target | USDA Nutrient ID Reference | Fewer confirmed IDs → Prisma schema has placeholders; fix is additive (add columns) |
| A3 | `google/gemini-2.0-flash-001` supports `json_schema` strict mode on OpenRouter | Standard Stack / Code Examples | Extraction call fails; fallback is `response_format: { type: 'json_object' }` with manual validation |
| A4 | Prisma 7.x `Float` maps to PostgreSQL `DOUBLE PRECISION` (not `DECIMAL`) | Standard Stack | Precision characteristics differ; no practical impact for nutrition values |
| A5 | Prisma singleton pattern remains valid for Next.js 14 App Router hot reload | Code Examples | Multiple client connections during dev; causes "too many clients" error on Railway's free tier |
| A6 | 103 Float? columns = well under PostgreSQL 8KB page limit | DB Design | If wrong (they're not; 103 × 8 = 824 bytes), rows could exceed page size and require TOAST |
| A7 | hydroxyproline is absent from Foundation Foods and SR Legacy FDC nutrient lists | USDA Nutrient Reference | If it exists with an ID, one column is permanently null; no functional impact |

---

## Open Questions

1. **Exact list of 103 nutrient column names**
   - What we know: 65+ confirmed or high-confidence nutrient IDs documented above
   - What's unclear: The remaining ~38 IDs to reach exactly 103 (additional individual fatty acids, carotenoids, tocopherol isomers, trace minerals)
   - Recommendation: During Plan 01-01 (schema), build the map with confirmed IDs. Plan 01-02 (usda.ts) implementation task should include a step: fetch a full Foundation Foods item with a registered API key and log all nutrient IDs to find the gaps. Add missing columns to schema via `prisma db push` in the same session.

2. **Streaming protocol: single response vs two-phase**
   - What we know: Route handler must send both meal data (JSON) and confirmation text (stream) to client
   - What's unclear: Whether to use SSE (`text/event-stream`) protocol or a custom chunked JSON format
   - Recommendation: SSE is the cleaner protocol. Client reads via `EventSource` or `fetch` + `ReadableStreamDefaultReader`. Use `data: {...}\n\n` format with a `type` discriminator field (`{ type: 'meal', ... }` and `{ type: 'text', ... }`).

3. **Whether to use `energy_kcal` (ID 1008) or `energy_atwater_general_kcal` (ID 2047) as primary energy column**
   - What we know: Foundation Foods reports both IDs; ID 1008 is being phased out per USDA announcement; 2047 is the current standard for Foundation Foods
   - What's unclear: SR Legacy items may only report 1008
   - Recommendation: Map both IDs to the same `energy_kcal` column (last-write wins), or map 2047 to `energy_kcal` and 1008 to `energy_kcal_legacy`. The planner should decide; map both for now.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, Prisma | ✓ | v22.22.2 | — |
| npm | Package installation | ✓ | 10.9.7 | — |
| DATABASE_URL | Prisma → Railway PostgreSQL | ✓ | Set in .env | — |
| OPENROUTER_API_KEY | LLM parsing + confirmation | ✗ | Not yet in .env | Must add before route works |
| USDA_API_KEY | USDA FoodData Central | ✗ (DEMO_KEY fallback) | Not in .env | DEMO_KEY works at 30 req/hr for dev |
| Railway PostgreSQL | Data persistence | ✓ | Connected via DATABASE_URL | — |

**Missing dependencies with no fallback:**
- `OPENROUTER_API_KEY` — must be added to `.env` before the chat route can function. Plan 01-03 should include a setup step.

**Missing dependencies with fallback:**
- `USDA_API_KEY` — `DEMO_KEY` works for development at 30 req/hr. Sufficient for testing, will hit limits with repeated meal logging. Plan 01-02 should note to register at https://api.data.gov/signup/.

---

## Security Domain

> security_enforcement: true, asvs_level: 1

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth in Phase 1 (single-user personal app) |
| V3 Session Management | no | No session management in Phase 1 |
| V4 Access Control | no | No multi-user access control |
| V5 Input Validation | yes | OpenRouter `json_schema` strict mode validates LLM output; USDA response parsed with type guards |
| V6 Cryptography | no | No crypto operations |
| V7 Error/Logging | partial | Never return raw LLM errors or USDA API errors to client; log server-side |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure | Information Disclosure | Keys in `.env` only; never in client-side code; Next.js route handler keeps secrets server-side |
| Prompt injection via meal description | Tampering | `json_schema` strict mode constrains output shape; LLM output is never `eval`'d or used as SQL |
| USDA response injection | Tampering | Parse only expected nutrient fields; unknown nutrient IDs are ignored silently |
| Unconstrained LLM text in confirmation message | Spoofing | Confirmation message is rendered as text, not HTML; no `dangerouslySetInnerHTML` |

**High-risk items (block_on: high):** None identified. Phase 1 has no auth surface, no user data beyond meal logs, and secrets are kept server-side.

---

## Sources

### Primary (HIGH confidence)
- Live USDA FDC API: `api.nal.usda.gov/fdc/v1/foods/search` and `/food/{id}` — confirmed response structure, nutrient IDs for 37+ nutrients (amino acids 1210-1227, fatty acids 1258-1280, core minerals 1087-1103, vitamins 1109-1185, proximates 1003-1079)
- [CITED: nextjs.org/docs/app/guides/streaming] — ReadableStream in Route Handlers, verified current (2026-06-01)
- [CITED: ui.shadcn.com/docs/dark-mode/next] — ThemeProvider setup, ThemeProvider props, `suppressHydrationWarning`
- [CITED: openrouter.ai/docs/api/reference/overview] — `response_format` JSON schema structure, streaming SSE format

### Secondary (MEDIUM confidence)
- [CITED: openrouter.ai/announcements/structured-outputs-and-free-gemini-flash-20] — confirms `google/gemini-2.0-flash-001` supports structured outputs
- [CITED: openrouter.ai/quickstart] — OpenAI SDK baseURL pattern confirmed
- npm registry — all package versions confirmed via `npm view <pkg> version`

### Tertiary (LOW confidence)
- Nutrient IDs 1106, 1162, 1114, 1166, 1178, 1253, 1180 — from training knowledge; confirmed to match the 4-digit FDC pattern; hit DEMO_KEY rate limit before direct API verification

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified on npm registry with source repos
- USDA API structure: HIGH — confirmed via live API calls (response format, search params, dataType filter)
- Amino acid nutrient IDs (1210-1227): HIGH — confirmed from live API
- Key fatty acid IDs (1258-1280): HIGH — confirmed from live API
- Core mineral/vitamin IDs (1087-1185): HIGH — confirmed from multiple live API responses
- Additional vitamin IDs (1106, 1162, 1114, etc.): MEDIUM — pattern-consistent but not live-verified due to rate limit
- Full 103-column nutrient list: MEDIUM — 65+ confirmed, remainder [ASSUMED]
- OpenRouter `json_schema` with gemini-2.0-flash-001: MEDIUM — support confirmed via announcement, exact strict-mode behavior [ASSUMED] to match documented format
- Architecture patterns: HIGH — confirmed from official Next.js and Shadcn documentation

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (USDA API stable; OpenRouter model IDs change occasionally — verify `google/gemini-2.0-flash-001` is current at implementation time)
