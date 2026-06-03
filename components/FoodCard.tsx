'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string
  name: string
  quantityDisplay: string
  usdaMatched: boolean
  usdaFdcId: number | null
  energy_kcal: number | null
  protein_g: number | null
  carbohydrate_g: number | null
  fat_total_g: number | null
  fiber_g: number | null
  [key: string]: unknown
}

export interface Meal {
  id: string
  description: string
  foodItems: FoodItem[]
}

export type Message =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string }
  | { id: string; role: 'meal'; meal: Meal }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a display unit from a nutrient column name suffix.
 * e.g. protein_g → 'g', sodium_mg → 'mg', vitamin_b12_mcg → 'mcg', energy_kcal → 'kcal'
 */
function unitFromKey(key: string): string {
  if (key.endsWith('_mcg')) return 'mcg'
  if (key.endsWith('_mg')) return 'mg'
  if (key.endsWith('_kcal')) return 'kcal'
  if (key.endsWith('_g')) return 'g'
  return ''
}

/**
 * Convert a snake_case column name to a human-readable label.
 * e.g. vitamin_c_mg → 'Vitamin c mg'  (first letter uppercase, underscores → spaces)
 */
function labelFromKey(key: string): string {
  const words = key.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Keys that are shown in the collapsed header row — excluded from nutrient detail list */
const HEADER_KEYS = new Set([
  'id',
  'name',
  'quantityDisplay',
  'quantityG',
  'usdaMatched',
  'usdaFdcId',
  'usdaDescription',
  'mealId',
  'createdAt',
  'energy_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_total_g',
])

// ── FoodCard ──────────────────────────────────────────────────────────────────

interface FoodCardProps {
  item: FoodItem
  mealId?: string
  onDelete?: (mealId: string) => void
}

export function FoodCard({ item, mealId, onDelete }: FoodCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const kcalDisplay =
    item.energy_kcal !== null && item.energy_kcal !== undefined
      ? `${Math.round(item.energy_kcal)} kcal`
      : '— kcal'

  // Collect expanded nutrient rows (non-null numbers, excluding header keys)
  const nutrientRows = Object.entries(item).filter(([key, value]) => {
    if (HEADER_KEYS.has(key)) return false
    if (typeof value !== 'number' || value === null) return false
    return true
  }) as [string, number][]

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="w-full">
        <CardHeader className="pb-2 pt-3 px-3">
          {/* Row 1: dot + name + kcal badge + delete button + chevron */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                item.usdaMatched ? 'bg-green-500' : 'bg-zinc-400'
              }`}
              title={
                item.usdaMatched
                  ? 'Matched in USDA FoodData Central'
                  : 'No USDA match — nutrient data unavailable for this item'
              }
            />
            <span className="text-sm font-normal truncate flex-1">{item.name}</span>
            {item.quantityDisplay && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {item.quantityDisplay}
              </span>
            )}
            <Badge variant="secondary" className="flex-shrink-0 text-xs">
              {kcalDisplay}
            </Badge>
            {mealId && onDelete && (
              <button
                className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Delete meal"
                onClick={() => onDelete(mealId)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            )}
            <CollapsibleTrigger asChild>
              <button
                className="flex-shrink-0 rounded p-0.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.name} nutrient details`}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>
          {/* Row 2: macro pills (always visible) */}
          <div className="flex items-center gap-1 mt-1 ml-4">
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs border-0">
              P: {item.protein_g?.toFixed(1) ?? '—'}g
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs border-0">
              C: {item.carbohydrate_g?.toFixed(1) ?? '—'}g
            </Badge>
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs border-0">
              F: {item.fat_total_g?.toFixed(1) ?? '—'}g
            </Badge>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="px-3 pb-3 pt-0">
            <Separator className="mb-2" />
            {nutrientRows.length > 0 ? (
              <div className="space-y-1">
                {nutrientRows.map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs text-muted-foreground">
                    <span>{labelFromKey(key)}</span>
                    <span>
                      {value.toFixed(2)} {unitFromKey(key)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No detailed nutrient data available for this item.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
