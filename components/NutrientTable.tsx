'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { goalStatus, STATUS_DOT_BG } from '@/lib/goalStatus'

interface Totals {
  [key: string]: number
}

interface NutrientRow {
  key: string
  label: string
  unit: string
  decimals?: number
}

const CATEGORIES: { title: string; rows: NutrientRow[] }[] = [
  {
    title: 'Minerals',
    rows: [
      { key: 'calcium_mg',    label: 'Calcium',    unit: 'mg' },
      { key: 'iron_mg',       label: 'Iron',       unit: 'mg', decimals: 1 },
      { key: 'magnesium_mg',  label: 'Magnesium',  unit: 'mg' },
      { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg' },
      { key: 'potassium_mg',  label: 'Potassium',  unit: 'mg' },
      { key: 'sodium_mg',     label: 'Sodium',     unit: 'mg' },
      { key: 'zinc_mg',       label: 'Zinc',       unit: 'mg', decimals: 1 },
      { key: 'copper_mg',     label: 'Copper',     unit: 'mg', decimals: 2 },
      { key: 'manganese_mg',  label: 'Manganese',  unit: 'mg', decimals: 2 },
      { key: 'selenium_mcg',  label: 'Selenium',   unit: 'mcg', decimals: 1 },
    ],
  },
  {
    title: 'Vitamins',
    rows: [
      { key: 'vitamin_a_rae_mcg',   label: 'Vitamin A',         unit: 'mcg' },
      { key: 'vitamin_c_mg',        label: 'Vitamin C',         unit: 'mg', decimals: 1 },
      { key: 'vitamin_d_mcg',       label: 'Vitamin D',         unit: 'mcg', decimals: 1 },
      { key: 'vitamin_e_mg',        label: 'Vitamin E',         unit: 'mg', decimals: 1 },
      { key: 'vitamin_k1_mcg',      label: 'Vitamin K1',        unit: 'mcg', decimals: 1 },
      { key: 'thiamin_mg',          label: 'Thiamin (B1)',       unit: 'mg', decimals: 2 },
      { key: 'riboflavin_mg',       label: 'Riboflavin (B2)',    unit: 'mg', decimals: 2 },
      { key: 'niacin_mg',           label: 'Niacin (B3)',        unit: 'mg', decimals: 1 },
      { key: 'vitamin_b6_mg',       label: 'Vitamin B6',        unit: 'mg', decimals: 2 },
      { key: 'vitamin_b12_mcg',     label: 'Vitamin B12',       unit: 'mcg', decimals: 2 },
      { key: 'folate_total_mcg',    label: 'Folate',            unit: 'mcg' },
      { key: 'pantothenic_acid_mg', label: 'Pantothenic Acid',  unit: 'mg', decimals: 1 },
      { key: 'biotin_mcg',          label: 'Biotin',            unit: 'mcg', decimals: 1 },
      { key: 'choline_total_mg',    label: 'Choline',           unit: 'mg' },
    ],
  },
  {
    title: 'Fats',
    rows: [
      { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg' },
      { key: 'sfa_total_g',    label: 'Saturated Fat', unit: 'g', decimals: 1 },
      { key: 'mufa_total_g',   label: 'Monounsaturated Fat', unit: 'g', decimals: 1 },
      { key: 'pufa_total_g',   label: 'Polyunsaturated Fat', unit: 'g', decimals: 1 },
      { key: 'pufa_20_5_epa_g', label: 'EPA (Omega-3)', unit: 'g', decimals: 2 },
      { key: 'pufa_22_6_dha_g', label: 'DHA (Omega-3)', unit: 'g', decimals: 2 },
    ],
  },
  {
    title: 'Sugars & Other',
    rows: [
      { key: 'sugars_total_g', label: 'Total Sugars', unit: 'g', decimals: 1 },
      { key: 'sugars_added_g', label: 'Added Sugars',  unit: 'g', decimals: 1 },
      { key: 'starch_g',       label: 'Starch',        unit: 'g', decimals: 1 },
      { key: 'caffeine_mg',    label: 'Caffeine',      unit: 'mg', decimals: 1 },
      { key: 'sodium_mg',      label: 'Sodium',        unit: 'mg' },
    ],
  },
]

function fmt(val: number, decimals = 0) {
  return val.toFixed(decimals)
}

function Section({
  title,
  rows,
  totals,
  goals,
}: {
  title: string
  rows: NutrientRow[]
  totals: Totals
  goals?: Record<string, number>
}) {
  const [open, setOpen] = useState(true)
  const visible = rows.filter(
    (r) => (totals[r.key] ?? 0) > 0 || (goals?.[r.key] != null && goals[r.key] > 0),
  )
  if (visible.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>

      {open && (
        <div>
          {visible.map((row, i) => {
            const intake = totals[row.key] ?? 0
            const goal = goals?.[row.key]
            const status = goalStatus(intake, goal)
            return (
              <div key={row.key}>
                {i > 0 && <Separator />}
                <div className="flex justify-between items-center py-2 px-1 text-sm">
                  <span className="text-foreground">{row.label}</span>
                  <div className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
                    {goal != null && (
                      <span
                        className={`h-2 w-2 rounded-full inline-block flex-shrink-0 ${STATUS_DOT_BG[status]}`}
                      />
                    )}
                    <span>
                      {fmt(intake, row.decimals ?? 0)}
                      {goal != null && (
                        <span className="text-muted-foreground/60">
                          {' / '}
                          {fmt(goal, row.decimals ?? 0)}
                        </span>
                      )}{' '}
                      {row.unit}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NutrientTable({
  totals,
  goals,
}: {
  totals: Totals
  goals?: Record<string, number>
}) {
  const hasAny = CATEGORIES.some((cat) =>
    cat.rows.some(
      (r) => (totals[r.key] ?? 0) > 0 || (goals?.[r.key] != null && goals[r.key] > 0),
    ),
  )

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No nutrient data for this day.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {CATEGORIES.map((cat) => (
        <Section key={cat.title} title={cat.title} rows={cat.rows} totals={totals} goals={goals} />
      ))}
    </div>
  )
}
