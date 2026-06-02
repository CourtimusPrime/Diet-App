'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface FastingSession {
  id: string
  startedAt: string
  targetHours: number
  protocol: string
}

interface Props {
  session: FastingSession | null
  onStart: (startedAt: Date) => void
  onEnd: (id: string) => void
  disabled?: boolean
}

const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, '0')
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FastingTimer({ session, onStart, onEnd, disabled }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [customStart, setCustomStart] = useState(() => toLocalDatetimeString(new Date()))

  useEffect(() => {
    if (!session) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session])

  const isFasting = !!session
  const elapsedSec = session ? Math.floor((now - new Date(session.startedAt).getTime()) / 1000) : 0
  const targetSec = session ? session.targetHours * 3600 : 0
  const progress = session ? Math.min(elapsedSec / targetSec, 1) : 0
  const remainingSec = session ? Math.max(targetSec - elapsedSec, 0) : 0
  const goalReached = session ? elapsedSec >= targetSec : false

  const strokeOffset = CIRCUMFERENCE * (1 - progress)
  const ringColor = goalReached
    ? 'stroke-green-500'
    : isFasting
      ? 'stroke-blue-500'
      : 'stroke-muted'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <div className="relative">
        <svg width="200" height="200" className="-rotate-90">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          {isFasting && (
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              className={`${ringColor} transition-all duration-1000`}
            />
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isFasting ? (
            <>
              <span className="text-2xl font-mono font-semibold tabular-nums">
                {formatDuration(elapsedSec)}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">elapsed</span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold text-muted-foreground">Not fasting</span>
            </>
          )}
        </div>
      </div>

      {/* Status badges */}
      {isFasting && (
        <div className="flex items-center gap-2">
          <Badge
            className={
              goalReached
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0'
            }
          >
            {goalReached ? 'Goal reached!' : 'Fasting'}
          </Badge>
          {!goalReached && (
            <span className="text-sm text-muted-foreground">
              {formatDuration(remainingSec)} remaining
            </span>
          )}
        </div>
      )}

      {/* Started at */}
      {isFasting && session && (
        <p className="text-xs text-muted-foreground">
          Started{' '}
          {new Date(session.startedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}target {session.protocol}
        </p>
      )}

      {/* Custom start time picker (only when not fasting) */}
      {!isFasting && (
        <div className="flex flex-col items-center gap-1">
          <label className="text-xs text-muted-foreground">Started at</label>
          <input
            type="datetime-local"
            value={customStart}
            max={toLocalDatetimeString(new Date())}
            onChange={(e) => setCustomStart(e.target.value)}
            disabled={disabled}
            className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
          />
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={
          isFasting && session
            ? () => onEnd(session.id)
            : () => onStart(new Date(customStart))
        }
        disabled={disabled}
        variant={isFasting ? 'outline' : 'default'}
        size="lg"
        className="w-40"
      >
        {isFasting ? 'End Fast' : 'Start Fast'}
      </Button>
    </div>
  )
}
