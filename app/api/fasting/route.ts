import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

function durationMinutes(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60000)
}

function computeStreak(
  sessions: { startedAt: Date; endedAt: Date; targetHours: number }[],
): number {
  const metDates = new Set(
    sessions
      .filter((s) => durationMinutes(s.startedAt, s.endedAt) / 60 >= s.targetHours)
      .map((s) => s.startedAt.toISOString().slice(0, 10)),
  )

  let streak = 0
  const d = new Date()
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if (!metDates.has(key)) break
    streak++
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return streak
}

export async function GET() {
  const [active, completed] = await Promise.all([
    prisma.fastingSession.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.fastingSession.findMany({
      where: { endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 30,
    }),
  ])

  const enriched = (completed as (typeof completed[0] & { endedAt: Date })[]).map((s) => ({
    ...s,
    durationMinutes: durationMinutes(s.startedAt, s.endedAt),
    metGoal: durationMinutes(s.startedAt, s.endedAt) / 60 >= s.targetHours,
  }))

  const history = enriched.slice(0, 7)

  const completedWithEnd = completed.filter((s) => s.endedAt != null) as (typeof completed[0] & {
    endedAt: Date
  })[]

  const longestFastHours =
    completedWithEnd.length > 0
      ? Math.max(...completedWithEnd.map((s) => durationMinutes(s.startedAt, s.endedAt) / 60))
      : 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recent7 = completedWithEnd.filter((s) => s.startedAt >= sevenDaysAgo)
  const avgFastHours7d =
    recent7.length > 0
      ? recent7.reduce((sum, s) => sum + durationMinutes(s.startedAt, s.endedAt) / 60, 0) /
        recent7.length
      : 0

  const streak = computeStreak(
    completedWithEnd.map((s) => ({
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      targetHours: s.targetHours,
    })),
  )

  return NextResponse.json({
    active,
    history,
    stats: { streak, longestFastHours, avgFastHours7d },
  })
}

export async function POST(req: Request) {
  const existing = await prisma.fastingSession.findFirst({ where: { endedAt: null } })
  if (existing) {
    return NextResponse.json({ error: 'Fast already active' }, { status: 409 })
  }

  const body = (await req.json()) as { targetHours: number; protocol: string; startedAt?: string }
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date()
  const session = await prisma.fastingSession.create({
    data: {
      startedAt,
      targetHours: body.targetHours,
      protocol: body.protocol,
    },
  })
  return NextResponse.json(session, { status: 201 })
}
