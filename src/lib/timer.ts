import type { Task } from './types'

/** Focus length when neither the plan nor the title says otherwise. */
export const DEFAULT_MINUTES = 25

/**
 * Read a length out of a title: "Easy walk 15-20 min" → 15, "45m circuit" → 45, "1 hour" → 60.
 * A range takes its lower bound — the minimum is what you commit to.
 */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
}

export function inferMinutes(title: string): number | null {
  const m = /\b(\d+|[a-z]+)[\s-]*(?:-\s*\d+\s*)?(min(?:ute)?s?|m|h(?:ou)?rs?|h)\b/i.exec(title)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : (WORDS[m[1].toLowerCase()] ?? 0)
  if (!n) return null
  return /^h/i.test(m[2]) ? n * 60 : n
}

export function resolveMinutes(task: Pick<Task, 'title' | 'duration_min'>): number {
  return task.duration_min ?? inferMinutes(task.title) ?? DEFAULT_MINUTES
}

/** "14:59", or "1:02:03" once an hour is involved. Never negative. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`
  return min % 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min / 60}h`
}
