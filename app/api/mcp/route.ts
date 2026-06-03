import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { prisma } from '@/app/lib/prisma'
import { NUTRIENT_META, localDateStr, getDailyTotals } from '@/lib/nutrientMeta'

// Session store — persists in Railway's long-running Node.js process
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>()

function buildServer(): McpServer {
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
    'Get all saved daily nutrition goals.',
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

  return server
}

function newTransport(): WebStandardStreamableHTTPServerTransport {
  let transport!: WebStandardStreamableHTTPServerTransport
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => { sessions.set(id, transport) },
    onsessionclosed: (id) => { sessions.delete(id) },
  })
  return transport
}

export async function POST(req: Request) {
  const sessionId = req.headers.get('mcp-session-id')

  if (sessionId) {
    const transport = sessions.get(sessionId)
    if (!transport) return new Response('Session not found', { status: 404 })
    return transport.handleRequest(req)
  }

  // New session — initialize handshake
  const transport = newTransport()
  const server = buildServer()
  await server.connect(transport)
  return transport.handleRequest(req)
}

export async function GET(req: Request) {
  const sessionId = req.headers.get('mcp-session-id')
  if (!sessionId) return new Response('Missing mcp-session-id header', { status: 400 })
  const transport = sessions.get(sessionId)
  if (!transport) return new Response('Session not found', { status: 404 })
  return transport.handleRequest(req)
}

export async function DELETE(req: Request) {
  const sessionId = req.headers.get('mcp-session-id')
  if (!sessionId) return new Response('Missing mcp-session-id header', { status: 400 })
  const transport = sessions.get(sessionId)
  if (!transport) return new Response('Session not found', { status: 404 })
  return transport.handleRequest(req)
}
