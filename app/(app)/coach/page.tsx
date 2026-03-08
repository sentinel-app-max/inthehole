'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { buildCoachContext } from '@/lib/coach/context'
import { analyseSwings, getClubBreakdown } from '@/lib/swing/analyser'
import MantraOverlay from '@/components/scorecard/MantraOverlay'

// ─── types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  "Why am I hitting it thin?",
  "How do I stop slicing?",
  "What should I work on first?",
  "Help me fix my chipping",
]

// ─── component ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [context, setContext] = useState('')
  const [swingContext, setSwingContext] = useState<{
    swingAnalysis: object | null
    clubBreakdown: object[]
  }>({ swingAnalysis: null, clubBreakdown: [] })

  // After-response prompt
  const [showAfterPrompt, setShowAfterPrompt] = useState(false)

  // Mantra state
  const [pendingMantra, setPendingMantra] = useState<string | null>(null)
  const [showMantraOverlay, setShowMantraOverlay] = useState(false)
  const [isSavingMantra, setIsSavingMantra] = useState(false)
  const [activeMantra, setActiveMantra] = useState<string | null>(null)
  const [isLoadingMantra, setIsLoadingMantra] = useState(false)
  const [totalShots, setTotalShots] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [coachBlockDismissed, setCoachBlockDismissed] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── redirect if not authed ──
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // ── load player context ──
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [profileSnap, bagSnap, sessionsSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'users', user.uid, 'bag', 'clubs')),
          getDocs(collection(db, 'users', user.uid, 'swingSessions')),
        ])

        const profile = profileSnap.data()
        const bagData = bagSnap.data()
        const sessions = sessionsSnap.docs.map((d) => d.data() as any)

        const analysis = analyseSwings(sessions)
        const breakdown = getClubBreakdown(sessions)

        setSwingContext({ swingAnalysis: analysis, clubBreakdown: breakdown })
        setTotalShots(sessions.length)
        setDataLoaded(true)

        const ctx = buildCoachContext({
          handicap: profile?.handicap ?? 18,
          clubs: bagData?.clubs ?? [],
          swingAnalysis: analysis,
          clubBreakdown: breakdown,
          recentShots: sessions.slice(-10),
        })
        setContext(ctx)

        if (profile?.mantra) {
          setActiveMantra(profile.mantra)
        }
      } catch (err) {
        console.error('Coach context load error:', err)
      }
    })()
  }, [user])

  // ── auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, showAfterPrompt])

  // ── send message ──
  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return

      setShowAfterPrompt(false)

      const newMessages: Message[] = [
        ...messages,
        { role: 'user', content: userText.trim() },
      ]
      setMessages(newMessages)
      setInput('')
      setIsStreaming(true)

      // Placeholder for streaming assistant reply
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context,
          }),
        })

        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            const trimmed = line.replace(/\r$/, '').trim()
            if (!trimmed.startsWith('data:')) continue

            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'content_block_delta') {
                const token = parsed.delta?.text || ''
                accumulated += token

                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: accumulated,
                  }
                  return updated
                })
              }
            } catch {
              // Malformed SSE line — skip silently
            }
          }
        }

        // Finalise message
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })

        // Show after-response prompt
        if (accumulated.trim()) {
          setShowAfterPrompt(true)
        }
      } catch (err) {
        console.error('Streaming error:', err)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: "Something went wrong. Give me a second and try again.",
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, context, isStreaming]
  )

  // ── get mantra ──
  async function handleGetMantra() {
    setShowAfterPrompt(false)
    setIsLoadingMantra(true)
    try {
      const res = await fetch('/api/coach/mantra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swingContext),
      })
      const data = await res.json()
      if (data.mantra) {
        setPendingMantra(data.mantra)
        setShowMantraOverlay(true)
      }
    } catch (err) {
      console.error('Get mantra error:', err)
    } finally {
      setIsLoadingMantra(false)
    }
  }

  // ── mantra actions ──
  async function handleUseMantra(mantra: string) {
    if (!user) return
    setIsSavingMantra(true)
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { mantra, updatedAt: serverTimestamp() },
        { merge: true }
      )
      setActiveMantra(mantra)
      setShowMantraOverlay(false)
    } catch (err) {
      console.error('Save mantra error:', err)
    } finally {
      setIsSavingMantra(false)
    }
  }

  if (loading) return null

  return (
    <>
      {/* Video background */}
      <video
        className="fixed inset-0 w-full h-full object-cover -z-10 pointer-events-none"
        src="/videos/Coach_8.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 bg-black/75 -z-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-screen pt-16 pb-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#c9a84c] uppercase tracking-widest">
                Coach
              </h1>
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Powered by Clean Harry
              </p>
            </div>

            {/* Active mantra pill */}
            {activeMantra && (
              <button
                onClick={() => {
                  setPendingMantra(activeMantra)
                  setShowMantraOverlay(true)
                }}
                className="flex items-center gap-2 border border-[#c9a84c]/40 rounded-full px-3 py-1"
              >
                <span className="text-[#c9a84c]" style={{ fontSize: 12 }}>◎</span>
                <span className="text-[10px] text-[#c9a84c]/80 uppercase tracking-widest font-thin">
                  {activeMantra}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
              <p className="text-white/60 text-sm leading-relaxed max-w-xs">
                Tell me what's going wrong with your game. I'll tell you exactly what to fix.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-3 py-1.5 rounded-full border border-white/20 text-white/60 text-xs uppercase tracking-wider hover:border-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#c9a84c] text-black font-medium'
                    : 'bg-white/10 text-white prose-coach'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content || '…'}</ReactMarkdown>
                ) : (
                  msg.content
                )}

                {/* Typing indicator */}
                {msg.role === 'assistant' &&
                  !msg.content &&
                  isStreaming &&
                  i === messages.length - 1 && (
                    <span className="flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
              </div>
            </div>
          ))}

          {/* After-response prompt */}
          {showAfterPrompt && !isStreaming && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2 items-start">
                <p className="text-white/40 text-xs uppercase tracking-widest font-thin pl-1">
                  Is there anything else?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAfterPrompt(false)}
                    className="px-3 py-1.5 rounded-full border border-white/20 text-white/50 text-xs uppercase tracking-wider hover:border-white/40 hover:text-white/70 transition-colors"
                  >
                    Yes, another question
                  </button>
                  <button
                    onClick={handleGetMantra}
                    disabled={isLoadingMantra}
                    className="px-3 py-1.5 rounded-full border border-[#c9a84c]/40 text-[#c9a84c] text-xs uppercase tracking-wider hover:border-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors disabled:opacity-50"
                  >
                    {isLoadingMantra ? 'Loading…' : 'Get my mantra'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-white/10 bg-black/40">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Ask your coach…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#c9a84c]/50 disabled:opacity-50"
              style={{ maxHeight: 100 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="w-10 h-10 rounded-full bg-[#c9a84c] text-black flex items-center justify-center text-lg disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      {/* Minimum shots blocker */}
      {dataLoaded && totalShots < 5 && !coachBlockDismissed && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="relative max-w-xs border border-[#c9a84c]/40 bg-[#141414] rounded-2xl p-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-[#c9a84c]/60 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#c9a84c] flex items-center justify-center">
                  <span className="text-[#c9a84c] text-xs font-bold">5</span>
                </div>
              </div>
              <h2 className="text-base font-bold uppercase tracking-wider text-center text-white">
                YOUR COACH NEEDS DATA
              </h2>
              <div className="w-8 h-px bg-[#c9a84c] mx-auto mb-4" />
              <p className="text-white/60 text-sm text-center leading-relaxed">
                Log at least <span className="text-[#c9a84c] font-bold">5 shots</span> in the Swing Analyser before your first session. The Coach uses your real swing patterns to give personalised advice, not generic tips.
              </p>
              <Link
                href="/swing/log"
                className="w-full bg-[#c9a84c] text-black font-bold uppercase tracking-wider py-3 rounded-xl text-center text-sm"
              >
                Go Log Shots
              </Link>
              <button
                onClick={() => setCoachBlockDismissed(true)}
                className="w-full border border-white/20 text-white/50 uppercase tracking-wider py-3 rounded-xl text-sm"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mantra overlay */}
      {showMantraOverlay && pendingMantra && (
        <MantraOverlay
          mantra={pendingMantra}
          onUse={handleUseMantra}
          onDismiss={() => setShowMantraOverlay(false)}
          isSaving={isSavingMantra}
        />
      )}
    </>
  )
}
