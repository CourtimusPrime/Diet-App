import { CheckCircle2, XCircle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface HistorySession {
  id: string
  startedAt: string
  endedAt: string
  protocol: string
  durationMinutes: number
  metGoal: boolean
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function FastingHistory({ sessions }: { sessions: HistorySession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-6">
        No completed fasts yet. Start your first one above.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {sessions.map((s, i) => (
        <div key={s.id}>
          {i > 0 && <Separator />}
          <div className="flex items-center justify-between py-3 px-1">
            <div className="flex items-center gap-3">
              {s.metGoal ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">{formatDate(s.startedAt)}</p>
                <p className="text-xs text-muted-foreground">{s.protocol}</p>
              </div>
            </div>
            <span
              className={`text-sm tabular-nums font-medium ${
                s.metGoal ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              }`}
            >
              {formatDuration(s.durationMinutes)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
