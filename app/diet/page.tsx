'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { MacroChart } from '@/components/MacroChart'
import { NutrientTable } from '@/components/NutrientTable'

interface DietData {
  date: string
  mealCount: number
  totals: Record<string, number>
}

interface GoalEntry {
  label: string
  targetAmount: number
  unit: string
}

function dateStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const FILTERS = [
  { label: 'Today',     offset: 0 },
  { label: 'Yesterday', offset: -1 },
]

export default function DietPage() {
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<DietData | null>(null)
  const [goals, setGoals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const loadGoals = useCallback(async () => {
    const res = await fetch('/api/goals')
    if (res.ok) {
      const json = (await res.json()) as { goals: Record<string, GoalEntry> }
      const flat: Record<string, number> = {}
      for (const [key, val] of Object.entries(json.goals)) {
        flat[key] = val.targetAmount
      }
      setGoals(flat)
    }
  }, [])

  const loadDiet = useCallback(async (dayOffset: number) => {
    setLoading(true)
    const res = await fetch(`/api/diet?date=${dateStr(dayOffset)}`)
    if (res.ok) {
      const json = (await res.json()) as DietData
      setData(json)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadGoals()
  }, [loadGoals])

  useEffect(() => {
    void loadDiet(offset)
  }, [loadDiet, offset])

  const hasData = data && (data.mealCount > 0 || Object.keys(goals).length > 0)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur">
        <BarChart2 className="mr-2 h-5 w-5" />
        <span className="font-semibold text-lg">Diet</span>
      </div>

      <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto w-full">
        {/* Filter pills */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.offset}
              onClick={() => setOffset(f.offset)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                offset === f.offset
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Empty state — no meals and no goals */}
        {!loading && !hasData && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No meals logged</h2>
            <p className="text-sm text-muted-foreground">
              Log food on the Log tab to see your nutrition summary here.
            </p>
          </div>
        )}

        {/* Macros card */}
        {hasData && data && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Macros · {data.mealCount} meal{data.mealCount !== 1 ? 's' : ''}
              </span>
            </CardHeader>
            <CardContent className="pt-0 pb-4 px-4">
              <MacroChart
                totals={{
                  energy_kcal: data.totals.energy_kcal ?? 0,
                  protein_g: data.totals.protein_g ?? 0,
                  carbohydrate_g: data.totals.carbohydrate_g ?? 0,
                  fat_total_g: data.totals.fat_total_g ?? 0,
                  fiber_g: data.totals.fiber_g ?? 0,
                }}
                goals={goals}
              />
            </CardContent>
          </Card>
        )}

        {/* Nutrients card */}
        {hasData && data && (
          <Card>
            <CardHeader className="pb-0 pt-4 px-4">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Nutrients
              </span>
            </CardHeader>
            <CardContent className="pt-0 pb-2 px-4">
              <NutrientTable totals={data.totals} goals={goals} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
