'use client'

interface Protocol {
  label: string
  hours: number
}

const PROTOCOLS: Protocol[] = [
  { label: '16:8', hours: 16 },
  { label: '18:6', hours: 18 },
  { label: '20:4', hours: 20 },
  { label: 'OMAD', hours: 23 },
]

interface Props {
  selected: Protocol
  onChange: (p: Protocol) => void
  disabled?: boolean
}

export function ProtocolSelector({ selected, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Protocol</span>
      <div className="flex gap-2">
        {PROTOCOLS.map((p) => {
          const active = p.hours === selected.hours
          return (
            <button
              key={p.label}
              onClick={() => onChange(p)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <span className="text-xs text-muted-foreground">{selected.hours}h fast</span>
    </div>
  )
}

export { PROTOCOLS }
export type { Protocol }
