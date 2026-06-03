import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/lib/auth'

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const start = new Date(`${today}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const meals = await prisma.meal.findMany({
    where: { createdAt: { gte: start, lt: end }, userId },
    include: { foodItems: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ meals })
}
