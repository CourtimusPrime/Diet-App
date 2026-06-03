import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { prisma } from '@/app/lib/prisma'
import { NUTRIENT_META, NUTRIENT_KEYS, localDateStr, getDailyTotals } from '@/lib/nutrientMeta'

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

const transport = new StdioServerTransport()
await server.connect(transport)
