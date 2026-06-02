'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Timer, BarChart2 } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Log', icon: MessageCircle },
  { href: '/fasting', label: 'Fasting', icon: Timer },
  { href: '/diet', label: 'Diet', icon: BarChart2 },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur border-t flex">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
              active
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
