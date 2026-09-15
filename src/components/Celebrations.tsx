import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useToday } from '../data/useToday'
import { achievements } from '../lib/achievements'
import type { Badge } from '../lib/achievements'
import { inkOf } from '../lib/colors'
import { levelFor, xpSummary } from '../lib/gamification'

interface Seen {
  level: number
  badges: string[]
}

const key = (userId: string) => `routine.seen.${userId}`

function readSeen(userId: string): Seen | null {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as Seen) : null
  } catch {
    return null
  }
}

function writeSeen(userId: string, seen: Seen) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(seen))
  } catch {
    /* ignore */
  }
}

/**
 * Watches level and badges and celebrates what's new since this device last looked:
 * a full-screen level-up (once per level, one tap to dismiss) and a small toast per badge.
 * The first visit on a device records the current state silently.
 */
export default function Celebrations() {
  const { me, friend, slotOf } = useAuth()
  const { tasks, completions, loading } = useData()
  const day = useToday()
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Badge[]>([])

  useEffect(() => {
    if (!me || loading) return
    const level = levelFor(xpSummary(tasks, completions, me.id, friend?.id ?? null, day).total).level
    const unlocked = achievements(tasks, completions, me.id, friend?.id ?? null, day).filter((b) => b.unlocked)
    const seen = readSeen(me.id)
    if (seen) {
      if (level > seen.level) setLevelUp(level)
      const fresh = unlocked.filter((b) => !seen.badges.includes(b.id))
      if (fresh.length) setToasts((t) => [...t, ...fresh])
    }
    writeSeen(me.id, { level, badges: [...new Set([...(seen?.badges ?? []), ...unlocked.map((b) => b.id)])] })
  }, [me, friend, tasks, completions, loading, day])

  // Toasts show one at a time for a few seconds each.
  useEffect(() => {
    if (toasts.length === 0) return
    const id = window.setTimeout(() => setToasts((t) => t.slice(1)), 3200)
    return () => window.clearTimeout(id)
  }, [toasts])

  // Safety net so a level-up never blocks the screen for good.
  useEffect(() => {
    if (levelUp === null) return
    const id = window.setTimeout(() => setLevelUp(null), 10_000)
    return () => window.clearTimeout(id)
  }, [levelUp])

  const color = me ? inkOf(slotOf(me.id)) : 'var(--ink)'
  const toast = toasts[0]

  return (
    <>
      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-surface-2 py-2 pl-3 pr-4 text-sm font-medium text-ink shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">
            <span aria-hidden>{toast.emoji}</span>
            {toast.name}
          </div>
        </div>
      )}
      {levelUp !== null && <LevelUp level={levelUp} color={color} onDismiss={() => setLevelUp(null)} />}
    </>
  )
}

function LevelUp({ level, color, onDismiss }: { level: number; color: string; onDismiss: () => void }) {
  const pieces = useMemo(() => {
    const palette = [color, 'var(--u1)', 'var(--u2)', 'var(--ink)']
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 220,
      spin: 360 + Math.random() * 900,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      color: palette[i % palette.length],
    }))
  }, [color])

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Level ${level}. Tap to continue`}
      className="fixed inset-0 z-50 flex cursor-default items-center justify-center overflow-hidden bg-ground/85 backdrop-blur-sm"
    >
      <span className="pointer-events-none absolute inset-0" aria-hidden>
        {pieces.map((p) => (
          <span
            key={p.id}
            className="absolute -top-6 block animate-confetti rounded-[2px]"
            style={{
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--drift' as string]: `${p.drift}px`,
              ['--spin' as string]: `${p.spin}deg`,
            }}
          />
        ))}
      </span>
      <span className="relative text-center">
        <span className="block text-sm font-semibold text-ink-2">Level up</span>
        <span className="block text-[104px] font-bold leading-none tabular-nums tracking-tight animate-pop" style={{ color }}>
          {level}
        </span>
      </span>
    </button>
  )
}
