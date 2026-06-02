import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.fastingSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.endedAt) return NextResponse.json({ error: 'Already ended' }, { status: 409 })

  const updated = await prisma.fastingSession.update({
    where: { id },
    data: { endedAt: new Date() },
  })
  return NextResponse.json(updated)
}
