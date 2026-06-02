---
phase: 01-logging-core
plan: 05
subsystem: bootstrap
tags: [next.js, shadcn, tailwind, prisma, setup]
dependency_graph:
  requires: []
  provides:
    - Next.js 14 App Router project scaffold
    - Shadcn UI New York style components (button, card, badge, collapsible, textarea, separator)
    - Tailwind 3 + Shadcn CSS variable design system
    - Prisma 7.8.0 initialized with PostgreSQL datasource
    - All production dependencies installed
  affects:
    - 01-01-PLAN.md (Prisma schema — project structure ready)
    - 01-02-PLAN.md (usda.ts — project structure ready)
    - 01-03-PLAN.md (chat route — openai SDK installed)
    - 01-04-PLAN.md (ChatInterface — Shadcn components available)
tech_stack:
  added:
    - next@14.2.35
    - next-themes@0.4.6
    - openai@6.41.0
    - lucide-react@1.17.0
    - prisma@7.8.0
    - "@prisma/client@7.8.0"
    - "@radix-ui/react-collapsible"
    - "@radix-ui/react-separator"
    - "@radix-ui/react-slot"
    - class-variance-authority
    - clsx
    - tailwind-merge
    - tailwindcss-animate
  patterns:
    - Shadcn New York style with Tailwind 3 CSS variables (HSL)
    - Radix UI primitives for accessible Shadcn components
    - Prisma 7.x with prisma.config.ts datasource configuration
key_files:
  created:
    - package.json
    - next.config.mjs
    - tsconfig.json
    - postcss.config.mjs
    - tailwind.config.ts
    - prisma/schema.prisma
    - prisma.config.ts
    - app/globals.css
    - app/layout.tsx
    - .env.example
    - components.json
    - components/ui/button.tsx
    - components/ui/card.tsx
    - components/ui/badge.tsx
    - components/ui/collapsible.tsx
    - components/ui/textarea.tsx
    - components/ui/separator.tsx
    - lib/utils.ts
  modified:
    - .gitignore (added /app/generated/prisma and .next entries)
decisions:
  - Used Tailwind 3-compatible Shadcn New York style components (Radix UI primitives) instead of Shadcn v4 CLI defaults (which generate Tailwind 4 + @base-ui/react incompatible output)
  - Installed tailwindcss-animate as required by tailwind.config.ts plugin directive from Shadcn v4 init
  - Fixed layout.tsx to use local GeistVF.woff font files instead of next/font/google Geist (not available in Next.js 14)
metrics:
  completed_date: "2026-06-02T08:23:03Z"
  duration: "~38 minutes"
  tasks_completed: 2
  tasks_total: 2
  files_created: 17
  files_modified: 2
---

# Phase 1 Plan 5: Next.js Bootstrap Summary

**One-liner:** Next.js 14 App Router bootstrapped with Tailwind 3 + Shadcn New York style (Zinc/CSS variables), Prisma 7.8 initialized against Railway PostgreSQL, all Wave 1 npm dependencies installed and build verified.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Initialise Next.js project and install all dependencies | a0708e6 | package.json, prisma/schema.prisma, tsconfig.json |
| 2 | Initialise Shadcn/ui and add globals.css + .env.example | 8dd918e | app/globals.css, components/ui/*, .env.example, tailwind.config.ts |

## Verification Results

| Check | Result |
|-------|--------|
| All 5 npm dependencies present (next-themes, openai, lucide-react, prisma, @prisma/client) | PASS |
| All 6 Shadcn components in components/ui/ | PASS |
| globals.css contains --background CSS variable | PASS (3 occurrences) |
| globals.css contains .dark block | PASS |
| .env listed in .gitignore | PASS |
| .env.example contains OPENROUTER_API_KEY, DATABASE_URL, USDA_API_KEY | PASS |
| .env.example contains no real API key | PASS |
| npm run build completes without errors | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shadcn v4 CLI generates Tailwind 4-incompatible output for Next.js 14**
- **Found during:** Task 2 — `npm run build` failed with `border-border class does not exist`
- **Issue:** `npx shadcn@latest init --defaults` (v4.10.0) generates `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, and `@base-ui/react` based components — all requiring Tailwind 4. Next.js 14 ships with Tailwind 3.
- **Fix:** Removed v4 components; wrote Tailwind 3 compatible globals.css with HSL CSS variables (Zinc/New York), updated tailwind.config.ts with full Shadcn color token mappings, wrote 6 standard Radix UI-based Shadcn components manually, created proper components.json with `"style": "new-york"`.
- **Files modified:** app/globals.css, tailwind.config.ts, components/ui/* (all 6), lib/utils.ts, components.json
- **Additional packages installed:** tailwindcss-animate, @radix-ui/react-collapsible, @radix-ui/react-separator, @radix-ui/react-slot
- **Commit:** 8dd918e

**2. [Rule 1 - Bug] layout.tsx import of `Geist` from `next/font/google` fails in Next.js 14**
- **Found during:** Task 2 — first build attempt failed with `Unknown font 'Geist'`
- **Issue:** Shadcn v4 init added `import { Geist } from "next/font/google"` to layout.tsx, but the Geist font is not in the Next.js 14 font registry (only available in Next.js 15+).
- **Fix:** Rewrote layout.tsx to use only `next/font/local` loading from the existing `app/fonts/GeistVF.woff` and `GeistMonoVF.woff` files. Also added `suppressHydrationWarning` to `<html>` per RESEARCH.md Pattern 5 (next-themes SSR flash prevention), and updated metadata to NutriLog.
- **Files modified:** app/layout.tsx
- **Commit:** 8dd918e (included in same Task 2 commit)

### Plan Notes

- The plan referred to `next.config.ts` but create-next-app@14 generates `next.config.mjs` — this is the correct format for that version; functionally equivalent.
- Prisma 7.x init creates `prisma.config.ts` (new in Prisma 7) alongside `prisma/schema.prisma`. The config file uses TypeScript with `defineConfig()` and reads DATABASE_URL via `dotenv/config`. This is the correct Prisma 7 pattern.
- Shadcn v4 init modified `tailwind.config.ts` to include the correct Shadcn configuration (darkMode class, CSS variables, borderRadius) — this was kept as-is since it was correct.

## Self-Check

### Files exist:
- package.json: FOUND
- app/globals.css: FOUND
- .env.example: FOUND
- components/ui/button.tsx: FOUND
- components/ui/card.tsx: FOUND
- components/ui/badge.tsx: FOUND
- components/ui/collapsible.tsx: FOUND
- components/ui/textarea.tsx: FOUND
- components/ui/separator.tsx: FOUND
- prisma/schema.prisma: FOUND
- tsconfig.json: FOUND

### Commits exist:
- a0708e6: FOUND (Task 1 — Next.js init)
- 8dd918e: FOUND (Task 2 — Shadcn + globals.css)

## Self-Check: PASSED
