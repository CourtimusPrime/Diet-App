'use client'

import { useCallback, useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FastingTimer } from '@/components/FastingTimer'
import { ProtocolSelector, PROTOCOLS } from '@/components/ProtocolSelector'
import type { Protocol } from '@/components/ProtocolSelector'
import { FastingHistory } from '@/components/FastingHistory'
import { FastingStats } from '@/components/FastingStats'

interface FastingSession {
  id: string
  startedAt: string
  endedAt: string | null
  targetHours: number
  protocol: string
  durationMinutes?: number
  metGoal?: boolean
}

interface StatsData {
  streak: number
  longestFastHours: number
  avgFastHours7d: number
}

const STORAGE_KEY = 'nutrilog_if_protocol'

function savedProtocol(): Protocol {
  if (typeof window === 'undefined') return PROTOCOLS[0]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return PROTOCOLS[0]
    const found = PROTOCOLS.find((p) => p.label === raw)
    return found ?? PROTOCOLS[0]
  } catch {
    return PROTOCOLS[0]
  }
}

export default function FastingPage() {
  const [active, setActive] = useState<FastingSession | null>(null)
  const [history, setHistory] = useState<FastingSession[]>([])
  const [stats, setStats] = useState<StatsData>({ streak: 0, longestFastHours: 0, avgFastHours7d: 0 })
  const [protocol, setProtocol] = useState<Protocol>(PROTOCOLS[0])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/fasting')
    if (!res.ok) return
    const data = (await res.json()) as {
      active: FastingSession | null
      history: FastingSession[]
      stats: StatsData
    }
    setActive(data.active)
    setHistory(data.history)
    setStats(data.stats)
    setLoading(false)
  }, [])

  useEffect(() => {
    setProtocol(savedProtocol())
    void load()
  }, [load])

  const handleProtocolChange = (p: Protocol) => {
    setProtocol(p)
    try {
      localStorage.setItem(STORAGE_KEY, p.label)
    } catch {
      // ignore
    }
  }

  const handleStart = async (startedAt: Date) => {
    const res = await fetch('/api/fasting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetHours: protocol.hours,
        protocol: protocol.label,
        startedAt: startedAt.toISOString(),
      }),
    })
    if (res.ok) void load()
  }

  const handleEnd = async (id: string) => {
    const res = await fetch(`/api/fasting/${id}`, { method: 'PATCH' })
    if (res.ok) void load()
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur">
        <Timer className="mr-2 h-5 w-5" />
        <span className="font-semibold text-lg">Fasting</span>
      </div>

      <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto w-full">
        {/* Timer card */}
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-6">
            <FastingTimer
              session={active}
              onStart={handleStart}
              onEnd={handleEnd}
              disabled={loading}
            />
            <Separator />
            <ProtocolSelector
              selected={protocol}
              onChange={handleProtocolChange}
              disabled={!!active || loading}
            />
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Stats
            </span>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <FastingStats stats={stats} />
          </CardContent>
        </Card>

        {/* History card */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Recent fasts
            </span>
          </CardHeader>
          <CardContent className="pt-0 pb-2 px-4">
            <FastingHistory
              sessions={
                history.filter((s) => s.endedAt != null) as (FastingSession & {
                  endedAt: string
                  durationMinutes: number
                  metGoal: boolean
                })[]
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
