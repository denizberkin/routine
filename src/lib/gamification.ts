import { addDays, parseISO } from 'date-fns'
import { toYmd, weekOf } from './schedule'
import type { Ymd } from './schedule'
import type { Completion } from './types'

/** XP to climb from level n to n+1 (spec §6): L1→L2 100, L2→L3 300, L3→L4 600, … */
export const stepXp = (n: number) => 50 * n * (n + 1)

export interface LevelInfo {
  level: number
  /** XP earned since reaching this level */
  into: number
  /** XP the current step costs */
  need: number
  /** into / need, 0..1 */
  progress: number
}

export function levelFor(xp: number): LevelInfo {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  while (rest >= stepXp(level)) {
    rest -= stepXp(level)
    level++
  }
  const need = stepXp(level)
  return { level, into: rest, need, progress: rest / need }
}

export function totalXp(completions: Completion[], userId: string): number {
  let sum = 0
  for (const c of completions) if (c.user_id === userId) sum += c.xp_awarded
  return sum
}

/** Days on which the user completed at least one task. */
export function activeDays(completions: Completion[], userId: string): Set<Ymd> {
  const days = new Set<Ymd>()
  for (const c of completions) if (c.user_id === userId) days.add(c.due_date)
  return days
}

/**
 * Current streak (spec §6). A day counts if ≥1 task was completed. One missed day per ISO week is
 * forgiven (it consumes that week's grace and doesn't add to the count); a second miss in the same
 * week ends the streak. Today doesn't count against you until it's over.
 */
export function streak(completions: Completion[], userId: string, today: Ymd): number {
  const active = activeDays(completions, userId)
  if (active.size === 0) return 0
  const earliest = [...active].sort()[0]
  const graceUsed = new Set<Ymd>()
  let count = 0
  let day = active.has(today) ? today : toYmd(addDays(parseISO(today), -1))
  while (day >= earliest) {
    if (active.has(day)) {
      count++
    } else {
      const { start } = weekOf(day)
      if (graceUsed.has(start)) break
      graceUsed.add(start)
    }
    day = toYmd(addDays(parseISO(day), -1))
  }
  return count
}
