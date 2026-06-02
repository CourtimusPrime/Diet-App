interface Stats {
  streak: number
  longestFastHours: number
  avgFastHours7d: number
}

function formatHours(h: number) {
  if (h === 0) return '—'
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function FastingStats({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Streak', value: stats.streak === 0 ? '—' : `${stats.streak}d` },
    { label: 'Longest', value: formatHours(stats.longestFastHours) },
    { label: '7-day avg', value: formatHours(stats.avgFastHours7d) },
  ]

  return (
    <div className="flex gap-4 justify-center">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}
