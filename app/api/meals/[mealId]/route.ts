import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/lib/auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ mealId: string }> }
) {
  const { mealId } = await params

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meal = await prisma.meal.findUnique({ where: { id: mealId } })
  if (!meal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Guard against orphan meals (pre-auth era) and cross-user deletes
  if (meal.userId === null || meal.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.meal.delete({ where: { id: mealId } })
  return NextResponse.json({ ok: true })
}
