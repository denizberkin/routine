import { addDays, parseISO } from 'date-fns'
import { scheduledInWeek, toYmd, weekOf } from './schedule'
import type { Ymd } from './schedule'
import type { Completion, Task } from './types'

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

/** Streak multiplier (spec §6): a week earns 1.25×, a month 1.5×. */
export function multiplier(streakLength: number): number {
  if (streakLength >= 30) return 1.5
  if (streakLength >= 7) return 1.25
  return 1
}

/**
 * XP a completion of `task` on `day` is worth right now: base × streak multiplier (streak as it
 * stands once this completion is counted, as of that day) × ½ if it's a backfill of a past day.
 */
export function awardFor(
  task: Pick<Task, 'id' | 'xp'>,
  day: Ymd,
  completions: Completion[],
  userId: string,
  now: Ymd,
): number {
  const withThis: Completion[] = [
    ...completions,
    { id: 'preview', task_id: task.id, user_id: userId, due_date: day, xp_awarded: 0, completed_at: '' },
  ]
  const mult = multiplier(streak(withThis, userId, day))
  const backfill = day < now ? 0.5 : 1
  return Math.round(task.xp * mult * backfill)
}

export const SAME_DAY_BONUS = 15
export const PARTY_BONUS = 50
export const PARTY_TARGET = 0.8

/** Days on which both users completed at least one task — each is worth SAME_DAY_BONUS to both. */
export function sameDays(completions: Completion[], a: string, b: string): Ymd[] {
  const da = activeDays(completions, a)
  const db = activeDays(completions, b)
  return [...da].filter((d) => db.has(d)).sort()
}

export interface PartyWeek {
  weekStart: Ymd
  done: number
  target: number
  hit: boolean
}

/** Weekly party goal (spec §6): combined completions vs 80% of what the plan asks of both users. */
export function partyWeek(tasks: Task[], completions: Completion[], weekStart: Ymd): PartyWeek {
  const { end } = weekOf(weekStart)
  const done = completions.filter((c) => c.due_date >= weekStart && c.due_date <= end).length
  const target = Math.ceil(scheduledInWeek(tasks, weekStart) * 2 * PARTY_TARGET)
  return { weekStart, done, target, hit: target > 0 && done >= target }
}

/** Every ISO week from the first completion to `now` that hit the party goal. */
export function partyWeeksHit(tasks: Task[], completions: Completion[], now: Ymd): PartyWeek[] {
  if (completions.length === 0) return []
  const first = weekOf(completions.map((c) => c.due_date).sort()[0]).start
  const last = weekOf(now).start
  const out: PartyWeek[] = []
  for (let w = first; w <= last; w = toYmd(addDays(parseISO(w), 7))) {
    const p = partyWeek(tasks, completions, w)
    if (p.hit) out.push(p)
  }
  return out
}

export interface XpSummary {
  base: number
  sameDayBonus: number
  partyBonus: number
  total: number
}

/** Everything that feeds the level: earned XP plus the derived co-op bonuses. */
export function xpSummary(
  tasks: Task[],
  completions: Completion[],
  userId: string,
  friendId: string | null,
  now: Ymd,
): XpSummary {
  const base = totalXp(completions, userId)
  const sameDayBonus = friendId ? sameDays(completions, userId, friendId).length * SAME_DAY_BONUS : 0
  const partyBonus = friendId ? partyWeeksHit(tasks, completions, now).length * PARTY_BONUS : 0
  return { base, sameDayBonus, partyBonus, total: base + sameDayBonus + partyBonus }
}
