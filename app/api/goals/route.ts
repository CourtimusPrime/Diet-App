import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  const rows = await prisma.dailyTarget.findMany()
  const goals: Record<string, { label: string; targetAmount: number; unit: string }> = {}
  for (const row of rows) {
    goals[row.columnName] = { label: row.label, targetAmount: row.targetAmount, unit: row.unit }
  }
  return NextResponse.json({ goals })
}

interface GoalInput {
  columnName: string
  label: string
  targetAmount: number
  unit: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as GoalInput[]
  const results = await Promise.all(
    body.map((g) =>
      prisma.dailyTarget.upsert({
        where: { columnName: g.columnName },
        update: { label: g.label, targetAmount: g.targetAmount, unit: g.unit },
        create: { columnName: g.columnName, label: g.label, targetAmount: g.targetAmount, unit: g.unit },
      }),
    ),
  )
  return NextResponse.json({ updated: results.length })
}
