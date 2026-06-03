'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Utensils } from 'lucide-react'
import { FoodCard } from '@/components/FoodCard'
import type { FoodItem, Meal, Message } from '@/components/FoodCard'

// ── ChatInterface ─────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  onMealLogged?: () => void
}

export function ChatInterface({ onMealLogged }: ChatInterfaceProps) {
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
              onMealLogged?.()
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
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
