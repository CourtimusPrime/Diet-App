'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Send, ChevronDown, ChevronUp, Loader2, Utensils } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FoodItem {
  id: string
  name: string
  quantityDisplay: string
  usdaMatched: boolean
  usdaFdcId: number | null
  energy_kcal: number | null
  protein_g: number | null
  carbohydrate_g: number | null
  fat_total_g: number | null
  [key: string]: unknown
}

interface Meal {
  id: string
  description: string
  foodItems: FoodItem[]
}

type Message =
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

function FoodCard({ item }: { item: FoodItem }) {
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
          {/* Row 1: dot + name + kcal badge + chevron */}
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

// ── ChatInterface ─────────────────────────────────────────────────────────────

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isPending, setIsPending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea between 40px and 120px
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    const scrollHeight = textareaRef.current.scrollHeight
    textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 120)}px`
  }, [input])

  const handleSubmit = async () => {
    if (!input.trim() || isPending) return

    const userText = input.trim()

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: userText },
    ])
    setInput('')
    setIsPending(true)

    // Placeholder assistant message id for accumulating streaming text
    const assistantId = crypto.randomUUID()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantAdded = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process all complete SSE chunks (separated by \n\n)
        const chunks = buffer.split('\n\n')
        // Keep the last (potentially incomplete) chunk in the buffer
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const line = chunk.trim()
          if (!line.startsWith('data: ')) continue

          const data = line.slice('data: '.length)

          if (data === '[DONE]') {
            setIsPending(false)
            break
          }

          try {
            const parsed = JSON.parse(data) as
              | { type: 'meal'; meal: Meal }
              | { type: 'text'; text: string }

            if (parsed.type === 'meal') {
              setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: 'meal', meal: parsed.meal },
              ])
            } else if (parsed.type === 'text') {
              if (!assistantAdded) {
                // Create the assistant message on first text chunk
                setMessages((prev) => [
                  ...prev,
                  { id: assistantId, role: 'assistant', content: parsed.text },
                ])
                assistantAdded = true
              } else {
                // Append subsequent text chunks
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId && msg.role === 'assistant'
                      ? { ...msg, content: msg.content + parsed.text }
                      : msg,
                  ),
                )
              }
            }
          } catch {
            // Non-JSON SSE data — skip
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Something went wrong logging that meal. Try again, or rephrase what you ate.',
        },
      ])
    } finally {
      setIsPending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
    // Shift+Enter: default textarea behavior (newline insertion)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header (sticky top) ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur">
        <Utensils className="mr-2 h-5 w-5" />
        <span className="flex-1 font-semibold text-lg">NutriLog</span>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/sign-in' })}>Sign out</Button>
      </div>

      {/* ── Scroll area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Utensils className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Start logging</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Describe what you ate — &apos;I had 2 scrambled eggs and toast&apos; — and I&apos;ll
              track the nutrition.
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm">
                  {msg.content}
                </div>
              </div>
            )
          }

          if (msg.role === 'assistant') {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] text-sm text-foreground">{msg.content}</div>
              </div>
            )
          }

          if (msg.role === 'meal') {
            return (
              <div key={msg.id} className="w-full space-y-2">
                {msg.meal.foodItems.map((item) => (
                  <FoodCard key={item.id} item={item} />
                ))}
              </div>
            )
          }

          return null
        })}

        {/* Typing indicator */}
        {isPending && (
          <div
            aria-live="polite"
            aria-label="Processing your meal"
            className="flex justify-start"
          >
            <div className="flex items-center gap-1 px-3 py-2">
              <span
                className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Fixed input bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 z-10 border-t bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur p-3">
        <div className="flex items-end gap-2 max-w-screen-sm mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What did you eat?"
            disabled={isPending}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
          />
          <Button
            type="button"
            size="icon"
            disabled={isPending || !input.trim()}
            onClick={() => void handleSubmit()}
            aria-label="Send message"
            className="h-11 w-11 flex-shrink-0"
          >
            {isPending ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
