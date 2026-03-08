'use client'

import { useState, useEffect } from 'react'

interface MantraOverlayProps {
  mantra: string
  onUse: (mantra: string) => void
  onDismiss: () => void
  isSaving?: boolean
}

export default function MantraOverlay({
  mantra: initialMantra,
  onUse,
  onDismiss,
  isSaving = false,
}: MantraOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [currentMantra] = useState(initialMantra)

  // Simple fade-in on mount
  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [currentMantra])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      {/* Concentric gold rings */}
      <div className="relative flex items-center justify-center mb-12">
        <div
          className="absolute rounded-full border border-[#c9a84c]/20"
          style={{ width: 160, height: 160 }}
        />
        <div
          className="absolute rounded-full border border-[#c9a84c]/35"
          style={{ width: 110, height: 110 }}
        />
        <div
          className="absolute rounded-full border border-[#c9a84c]/55"
          style={{ width: 70, height: 70 }}
        />
        <div
          className="rounded-full bg-[#c9a84c]"
          style={{ width: 12, height: 12 }}
        />
      </div>

      {/* Caddie lead-in */}
      <p
        className="text-white/50 text-xs uppercase tracking-[0.25em] font-thin mb-6 px-8 text-center transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        Your focus today
      </p>

      {/* Mantra — all words fade in together */}
      <div
        className="text-4xl font-thin text-white uppercase tracking-[0.25em] mb-10 px-8 text-center transition-opacity duration-[600ms]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {currentMantra.trim().toUpperCase()}
      </div>

      {/* Coaching note */}
      <p
        className="text-white/40 text-xs uppercase tracking-[0.2em] font-thin mb-4 px-10 text-center transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        Say it before every shot
      </p>

      {/* Actions */}
      <div
        className="flex flex-col gap-3 w-full max-w-xs px-6 transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <button
          onClick={() => onUse(currentMantra)}
          disabled={isSaving}
          className="w-full py-4 bg-[#c9a84c] text-black text-base font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {isSaving ? 'Saving…' : 'Use This'}
        </button>

        <button
          onClick={onDismiss}
          className="w-full py-2 text-white/30 text-xs uppercase tracking-widest"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
