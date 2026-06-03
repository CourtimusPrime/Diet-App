'use client'

import { useState, useCallback } from 'react'
import { TodayLog } from '@/components/TodayLog'
import { ChatInterface } from '@/components/ChatInterface'

export function LogTab() {
  const [refreshKey, setRefreshKey] = useState(0)
  const triggerRefetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <div className="flex flex-col h-screen bg-background">
      <TodayLog refreshKey={refreshKey} />
      <ChatInterface onMealLogged={triggerRefetch} />
    </div>
  )
}
