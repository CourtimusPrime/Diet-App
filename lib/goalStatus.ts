export type GoalStatus = 'none' | 'partial' | 'met' | 'over'

export function goalStatus(intake: number, goal?: number): GoalStatus {
  if (!goal || intake === 0) return 'none'
  if (intake > goal) return 'over'
  if (intake >= goal * 0.95) return 'met'
  return 'partial'
}

export const STATUS_COLORS: Record<GoalStatus, string> = {
  none:    'text-muted-foreground',
  partial: 'text-amber-500',
  met:     'text-green-500',
  over:    'text-red-500',
}

export const STATUS_FILLS: Record<GoalStatus, string> = {
  none:    '#9ca3af',
  partial: '#f59e0b',
  met:     '#22c55e',
  over:    '#ef4444',
}

export const STATUS_DOT_BG: Record<GoalStatus, string> = {
  none:    'bg-gray-300 dark:bg-gray-600',
  partial: 'bg-amber-400',
  met:     'bg-green-500',
  over:    'bg-red-500',
}
