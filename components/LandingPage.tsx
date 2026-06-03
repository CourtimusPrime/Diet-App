import Link from 'next/link'
import { Utensils, Zap, BarChart2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 max-w-lg w-full text-center">
        <Utensils className="w-14 h-14 text-primary" />
        <div className="flex flex-col gap-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">NutriLog</h1>
          <p className="text-lg text-muted-foreground">
            Log what you ate. Get complete nutrition data — every vitamin, mineral, and macro.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-muted-foreground mt-2 w-full">
          <li className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span>Natural language logging — just describe your meal</span>
          </li>
          <li className="flex items-center gap-3">
            <BarChart2 className="w-4 h-4 text-primary shrink-0" />
            <span>103 nutrients tracked automatically</span>
          </li>
          <li className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" />
            <span>Query your data with Claude AI</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-4">Personal nutrition intelligence</p>
      </div>
    </main>
  )
}
