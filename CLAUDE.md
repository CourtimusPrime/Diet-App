<!-- GSD:project-start source:PROJECT.md -->
## Project

**NutriLog**

A personal, mobile-first diet logging app where you tell an AI what you ate in plain language. It
parses the message, looks up every food item in the USDA FoodData Central database, and persists
complete nutrition data (103 nutrients per food item) to a PostgreSQL database. The logged data is
queryable via an MCP server, so you can ask Claude.ai about your intake, deficiencies, and targets
directly in conversation.

**Core Value:** You log food in one natural-language message and get back a complete nutritional record — every
vitamin, mineral, amino acid, and fatty acid — without manual lookup or data entry.

### Constraints

- **Tech Stack**: Next.js 14 (App Router), Prisma ORM, Railway PostgreSQL — personal project,
  familiar stack, easy Railway deployment
- **LLM Provider**: OpenRouter — model-agnostic, swap between Gemini Flash / Claude Haiku / GPT-4o
  Mini without code changes
- **Nutrient Schema**: Wide-column (103 `Float?` columns on FoodItem, not a key-value Nutrient
  table) — enables SQL-level aggregation, no joins for totals, clean MCP queries
- **USDA API**: Prefers Foundation Foods > SR Legacy > Branded for nutrient coverage depth
- **MCP Transport**: stdio (local) — sufficient for single-user Claude.ai integration
- **Deployment**: Railway with `prisma migrate deploy` on startup
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
