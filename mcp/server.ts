import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { prisma } from '@/app/lib/prisma'
import { NUTRIENT_META, NUTRIENT_KEYS, localDateStr, getDailyTotals } from '@/lib/nutrientMeta'
import { logMeal, NoFoodItemsError } from '@/app/lib/food'

const server = new McpServer({ name: 'nutrilog', version: '1.0.0' })

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

server.tool(
  'get_goals',
  'Get all saved daily nutrition goals (DailyTarget records).',
  {},
  async () => {
    const rows = await prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } })
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows) }] }
  },
)

server.tool(
  'set_goal',
  'Upsert a daily nutrition goal. Label and unit are auto-derived from the nutrient column name.',
  {
    columnName: z.string().describe('Nutrient column name, e.g. "protein_g" or "energy_kcal"'),
    targetAmount: z.number().describe("Daily target amount in the nutrient's native unit"),
  },
  async ({ columnName, targetAmount }) => {
    const meta = NUTRIENT_META[columnName]
    if (!meta) {
      return {
        content: [{ type: 'text' as const, text: `Unknown column: ${columnName}. Call list_nutrients to see valid names.` }],
        isError: true,
      }
    }
    const record = await prisma.dailyTarget.upsert({
      where: { columnName },
      update: { targetAmount, label: meta.label, unit: meta.unit },
      create: { columnName, targetAmount, label: meta.label, unit: meta.unit },
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(record) }] }
  },
)

server.tool(
  'list_nutrients',
  'List all 103 available nutrient column names with their labels and units.',
  {},
  async () => {
    const list = Object.entries(NUTRIENT_META).map(([key, { label, unit }]) => ({ columnName: key, label, unit }))
    return { content: [{ type: 'text' as const, text: JSON.stringify(list) }] }
  },
)

server.tool(
  'log_food',
  'Log a meal from a natural-language description. Extracts food items, looks up USDA nutritional data, and saves to the database.',
  { description: z.string().describe('Natural language meal description, e.g. "2 scrambled eggs and a slice of toast with butter"') },
  async ({ description }) => {
    try {
      const meal = await logMeal(description)
      const summary = {
        id: meal.id,
        createdAt: meal.createdAt,
        foods: meal.foodItems.map((f) => ({
          name: f.name,
          quantity: f.quantityDisplay,
          usdaMatched: f.usdaMatched,
        })),
        macros: {
          energy_kcal: meal.foodItems.reduce((s, f) => s + (f.energy_kcal ?? 0), 0),
          protein_g: meal.foodItems.reduce((s, f) => s + (f.protein_g ?? 0), 0),
          fat_total_g: meal.foodItems.reduce((s, f) => s + (f.fat_total_g ?? 0), 0),
          carbohydrate_g: meal.foodItems.reduce((s, f) => s + (f.carbohydrate_g ?? 0), 0),
        },
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary) }] }
    } catch (err) {
      if (err instanceof NoFoodItemsError) {
        return { content: [{ type: 'text' as const, text: 'No food items found in description. Be more specific about what you ate.' }], isError: true }
      }
      throw err
    }
  },
)

server.tool(
  'get_meals',
  'List meals logged on a specific date (or date range). Returns food items and quantities. Useful for reviewing eating habits.',
  {
    date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today'),
    days: z.number().int().min(1).max(30).optional().describe('Number of days back from `date` to include (e.g. 7 for the past week). Defaults to 1 (single day).'),
  },
  async ({ date, days = 1 }) => {
    const endDate = localDateStr(date)
    const start = new Date(endDate)
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const meals = await prisma.meal.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { foodItems: { select: { name: true, quantityDisplay: true, usdaMatched: true, energy_kcal: true, protein_g: true, fat_total_g: true, carbohydrate_g: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const result = meals.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      description: m.description,
      foods: m.foodItems.map((f) => ({ name: f.name, quantity: f.quantityDisplay, usdaMatched: f.usdaMatched })),
      macros: {
        energy_kcal: m.foodItems.reduce((s, f) => s + (f.energy_kcal ?? 0), 0),
        protein_g: m.foodItems.reduce((s, f) => s + (f.protein_g ?? 0), 0),
        fat_total_g: m.foodItems.reduce((s, f) => s + (f.fat_total_g ?? 0), 0),
        carbohydrate_g: m.foodItems.reduce((s, f) => s + (f.carbohydrate_g ?? 0), 0),
      },
    }))

    return { content: [{ type: 'text' as const, text: JSON.stringify({ from: start.toISOString().slice(0, 10), to: endDate, meals: result }) }] }
  },
)

server.tool(
  'get_remaining_targets',
  'Compare today\'s consumed nutrients against your daily targets. Returns progress for each nutrient with a set goal.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const [totals, targets] = await Promise.all([
      getDailyTotals(d),
      prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } }),
    ])
    if (targets.length === 0) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', targets: [] }) }] }
    }
    const result = targets.map((t) => {
      const consumed = totals[t.columnName] ?? 0
      return {
        columnName: t.columnName,
        label: t.label,
        unit: t.unit,
        target: t.targetAmount,
        consumed,
        remaining: Math.max(0, t.targetAmount - consumed),
        percent: t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0,
      }
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, targets: result }) }] }
  },
)

server.tool(
  'get_deficiencies',
  'Return nutrients where today\'s intake is below 80% of the daily goal. Sorted by worst deficit first.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const [totals, targets] = await Promise.all([
      getDailyTotals(d),
      prisma.dailyTarget.findMany(),
    ])
    if (targets.length === 0) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, message: 'No goals set. Use set_goal to define daily targets.', deficiencies: [] }) }] }
    }
    const deficiencies = targets
      .filter((t) => (totals[t.columnName] ?? 0) < t.targetAmount * 0.8)
      .map((t) => {
        const consumed = totals[t.columnName] ?? 0
        return {
          columnName: t.columnName,
          label: t.label,
          unit: t.unit,
          target: t.targetAmount,
          consumed,
          percent: t.targetAmount > 0 ? Math.round((consumed / t.targetAmount) * 100) : 0,
        }
      })
      .sort((a, b) => a.percent - b.percent)
    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, deficiencies }) }] }
  },
)

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
        totals: nutrients ? Object.fromEntries(nutrients.map((k) => [k, totals[k] ?? 0])) : totals,
      })
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify({ endDate, days, history }) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
