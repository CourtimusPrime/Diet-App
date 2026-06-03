'use client'

import { useState, useEffect, useCallback } from 'react'
import { FoodCard } from '@/components/FoodCard'
import type { FoodItem } from '@/components/FoodCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Utensils } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

type SortKey = 'chronological' | 'protein_g' | 'fat_total_g' | 'carbohydrate_g' | 'fiber_g'

interface FoodItemWithMeal extends FoodItem {
  mealId: string
}

interface TodayLogProps {
  refreshKey: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'chronological', label: 'Chronological' },
  { key: 'protein_g', label: 'Protein' },
  { key: 'fat_total_g', label: 'Fat' },
  { key: 'carbohydrate_g', label: 'Carbs' },
  { key: 'fiber_g', label: 'Fiber' },
]

// ── Pure helpers ───────────────────────────────────────────────────────────────

function sortItems(items: FoodItemWithMeal[], sort: SortKey): FoodItemWithMeal[] {
  if (sort === 'chronological') return items
  return [...items].sort((a, b) => {
    const av = typeof a[sort] === 'number' ? (a[sort] as number) : -Infinity
    const bv = typeof b[sort] === 'number' ? (b[sort] as number) : -Infinity
    return bv - av
  })
}

// ── SkeletonCard ───────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 flex-1 max-w-[60%]" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1 mt-1 ml-4">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-10" />
        </div>
      </CardHeader>
    </Card>
  )
}

// ── TodayLog ───────────────────────────────────────────────────────────────────

export function TodayLog({ refreshKey }: TodayLogProps) {
  const [foodItems, setFoodItems] = useState<FoodItemWithMeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('chronological')

  const fetchToday = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/meals/today')
      if (!res.ok) throw new Error('Failed to fetch')
      const { meals } = await res.json()
      const items: FoodItemWithMeal[] = meals.flatMap(
        (meal: { id: string; foodItems: FoodItem[] }) =>
          meal.foodItems.map((item) => ({ ...item, mealId: meal.id }))
      )
      setFoodItems(items)
    } catch {
      toast.error("Couldn't load today's meals.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchToday()
  }, [fetchToday, refreshKey])

  const handleDelete = (mealId: string) => {
    const snapshot = [...foodItems]
    setFoodItems((prev) => prev.filter((i) => i.mealId !== mealId))

    let undone = false
    toast('Meal deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true
          setFoodItems(snapshot)
        },
      },
    })

    setTimeout(async () => {
      if (undone) return
      try {
        const res = await fetch(`/api/meals/${mealId}`, { method: 'DELETE' })
        if (!res.ok) {
          await fetchToday()
          toast.error("Couldn't delete meal. Please try again.")
        }
      } catch {
        await fetchToday()
        toast.error("Couldn't delete meal. Check your connection.")
      }
    }, 5100)
  }

  const sortedItems = sortItems(foodItems, sortKey)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sort pill row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2 sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        {SORT_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={sortKey === key ? 'default' : 'outline'}
            className="flex-shrink-0 rounded-full text-xs h-7 px-3 whitespace-nowrap"
            aria-pressed={sortKey === key}
            onClick={() => setSortKey(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-2">
        {isLoading && (
          <div aria-busy="true" className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!isLoading && sortedItems.length === 0 && (
          <section
            aria-label="Empty log"
            className="flex flex-col items-center justify-center h-full text-center py-16"
          >
            <Utensils className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nothing logged today</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Use the chat below to log a meal
            </p>
          </section>
        )}

        {!isLoading &&
          sortedItems.length > 0 &&
          sortedItems.map((item) => (
            <FoodCard
              key={item.id}
              item={item}
              mealId={item.mealId}
              onDelete={handleDelete}
            />
          ))}
      </div>
    </div>
  )
}
