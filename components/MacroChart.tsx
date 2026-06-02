'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from 'recharts'
import { goalStatus, STATUS_COLORS, STATUS_FILLS } from '@/lib/goalStatus'

interface Totals {
  energy_kcal: number
  protein_g: number
  carbohydrate_g: number
  fat_total_g: number
  fiber_g: number
}

interface Props {
  totals: Totals
  goals?: Record<string, number>
}

const MACROS = [
  { key: 'protein_g',      label: 'Protein', color: '#3b82f6', kcalPer: 4 },
  { key: 'carbohydrate_g', label: 'Carbs',   color: '#f59e0b', kcalPer: 4 },
  { key: 'fat_total_g',    label: 'Fat',     color: '#ef4444', kcalPer: 9 },
  { key: 'fiber_g',        label: 'Fiber',   color: '#10b981', kcalPer: 0 },
]

export function MacroChart({ totals, goals }: Props) {
  const data = MACROS.map((m) => {
    const grams = totals[m.key as keyof Totals] ?? 0
    const goalGrams = goals?.[m.key]
    return {
      label: m.label,
      grams: Math.round(grams * 10) / 10,
      kcal: m.kcalPer > 0 ? Math.round(grams * m.kcalPer) : null,
      color: m.color,
      goalGrams,
      status: goalStatus(grams, goalGrams),
    }
  })

  const totalKcal = Math.round(totals.energy_kcal ?? 0)
  const maxGrams = Math.max(...data.map((d) => d.grams), 1)
  const maxGoalGrams = goals ? Math.max(...MACROS.map((m) => goals[m.key] ?? 0)) : 0
  const domainMax = Math.max(maxGrams * 1.15, maxGoalGrams * 1.05, 1)

  const calorieStatus = goalStatus(totalKcal, goals?.energy_kcal)

  return (
    <div className="flex flex-col gap-4">
      {/* Calorie total */}
      <div className="flex flex-col items-center">
        <span className={`text-4xl font-bold tabular-nums ${STATUS_COLORS[calorieStatus]}`}>
          {totalKcal.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground mt-0.5">
          {goals?.energy_kcal
            ? `kcal · goal ${goals.energy_kcal.toLocaleString()}`
            : 'kcal today'}
        </span>
      </div>

      {/* Macro bars */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 80, bottom: 0, left: 52 }}
          barCategoryGap="25%"
        >
          <XAxis type="number" domain={[0, domainMax]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={48}
            tick={{ fontSize: 13, fill: 'currentColor' }}
            axisLine={false}
            tickLine={false}
          />
          {/* Goal reference lines */}
          {data.map((entry) =>
            entry.goalGrams ? (
              <ReferenceLine
                key={`goal-${entry.label}`}
                x={entry.goalGrams}
                stroke="#6b7280"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            ) : null,
          )}
          <Bar dataKey="grams" radius={4}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              content={({ x, y, width, height, value, index }) => {
                const entry = data[index as number]
                const label =
                  entry.kcal != null
                    ? `${value}g · ${entry.kcal} kcal`
                    : `${value}g`
                const fill = STATUS_FILLS[entry.status]
                return (
                  <text
                    x={(x as number) + (width as number) + 8}
                    y={(y as number) + (height as number) / 2}
                    dominantBaseline="middle"
                    fontSize={12}
                    fill={fill}
                  >
                    {label}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
