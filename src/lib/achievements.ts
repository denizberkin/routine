import { differenceInCalendarDays, parseISO } from 'date-fns'
import { activeDays, sameDays, streak } from './gamification'
import type { Ymd } from './schedule'
import type { Completion, Task } from './types'

export interface Badge {
  id: string
  name: string
  emoji: string
  /** What earns it, in a few words */
  hint: string
  unlocked: boolean
  /** Shown on locked badges that count toward something */
  progress?: { done: number; need: number }
}

/** Longest streak the user has ever held, by the same grace-day rules as the live one. */
export function bestStreak(completions: Completion[], userId: string, today: Ymd): number {
  let best = streak(completions, userId, today)
  for (const day of activeDays(completions, userId)) best = Math.max(best, streak(completions, userId, day))
  return best
}

/** True if there is a gap of 3+ empty days between two active days. */
export function hasComeback(completions: Completion[], userId: string): boolean {
  const days = [...activeDays(completions, userId)].sort()
  for (let i = 1; i < days.length; i++) {
    if (differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) >= 4) return true
  }
  return false
}

/** Phases in which every `once` task is done by the user. */
export function clearedPhases(tasks: Task[], completions: Completion[], userId: string): string[] {
  const done = new Set(completions.filter((c) => c.user_id === userId).map((c) => c.task_id))
  const byPhase = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.recurrence !== 'once') continue
    const key = t.phase ?? ''
    byPhase.set(key, [...(byPhase.get(key) ?? []), t])
  }
  return [...byPhase].filter(([, list]) => list.every((t) => done.has(t.id))).map(([phase]) => phase)
}

const counting = (done: number, need: number) => ({
  unlocked: done >= need,
  progress: { done: Math.min(done, need), need },
})

/** The nine badges from spec §6, computed from history. */
export function achievements(
  tasks: Task[],
  completions: Completion[],
  userId: string,
  friendId: string | null,
  today: Ymd,
): Badge[] {
  const mine = completions.filter((c) => c.user_id === userId)
  const category = new Map(tasks.map((t) => [t.id, t.category.toLowerCase()]))
  const inCategory = (name: string) => mine.filter((c) => category.get(c.task_id) === name).length
  const early = mine.filter((c) => c.completed_at && new Date(c.completed_at).getHours() < 7).length
  const best = bestStreak(completions, userId, today)
  const synced = friendId ? sameDays(completions, userId, friendId).length : 0
  const cleared = clearedPhases(tasks, completions, userId)

  return [
    { id: 'first_step', name: 'First Step', emoji: '👣', hint: 'First completion', ...counting(mine.length, 1) },
    { id: 'consistent', name: 'Consistent', emoji: '🔁', hint: '7-day streak', ...counting(best, 7) },
    { id: 'committed', name: 'Committed', emoji: '🏛️', hint: '30-day streak', ...counting(best, 30) },
    { id: 'early_bird', name: 'Early Bird', emoji: '🌅', hint: '10 done before 7am', ...counting(early, 10) },
    { id: 'scholar', name: 'Scholar', emoji: '📚', hint: '10 RL tasks', ...counting(inCategory('rl'), 10) },
    { id: 'mover', name: 'Mover', emoji: '🏃', hint: '20 Exercise tasks', ...counting(inCategory('exercise'), 20) },
    { id: 'comeback', name: 'Comeback', emoji: '🔙', hint: 'Back after 3+ days off', unlocked: hasComeback(completions, userId) },
    { id: 'in_sync', name: 'In Sync', emoji: '🤝', hint: '10 days both in', ...counting(synced, 10) },
    { id: 'phase_clear', name: 'Phase Clear', emoji: '🏁', hint: 'Every one-off in a phase', unlocked: cleared.length > 0 },
  ]
}
