import { addDays, differenceInCalendarDays, format, getISODay, parseISO, startOfISOWeek } from 'date-fns'
import { WEEKDAYS } from './parser'
import type { Completion, Task } from './types'

/** Dates are passed around as 'YYYY-MM-DD' strings — they compare lexically and match Postgres `date`. */
export type Ymd = string

export const toYmd = (d: Date): Ymd => format(d, 'yyyy-MM-dd')
export const today = (): Ymd => toYmd(new Date())

export function inWindow(task: Pick<Task, 'starts_on' | 'ends_on'>, day: Ymd): boolean {
  return day >= task.starts_on && (task.ends_on === null || day <= task.ends_on)
}

/** ISO week (Mon–Sun) containing `day`, as [start, end]. Used by streak grace, weekly quotas and the party goal. */
export function weekOf(day: Ymd): { start: Ymd; end: Ymd } {
  const start = startOfISOWeek(parseISO(day))
  return { start: toYmd(start), end: toYmd(addDays(start, 6)) }
}

export function weekdayOf(day: Ymd): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[getISODay(parseISO(day)) - 1]
}

export function weeklyQuota(task: Pick<Task, 'recurrence'>): number | null {
  return task.recurrence.startsWith('weekly:') ? Number(task.recurrence.slice(7)) : null
}

/**
 * Is the task on today's list? `weekly:N` and `once` tasks are due any day of their window —
 * the screen decides whether to show them based on quota / completion.
 */
export function isDueOn(task: Task, day: Ymd): boolean {
  if (!inWindow(task, day)) return false
  const r = task.recurrence
  if (r === 'daily' || r === 'once' || r.startsWith('weekly:')) return true
  return r.slice(5).split(',').includes(weekdayOf(day))
}

/** Tasks with a fixed obligation on this day (daily + weekday tasks). Drives the calendar's full/partial marker. */
export function fixedTasksOn(tasks: Task[], day: Ymd): Task[] {
  return tasks.filter((t) => (t.recurrence === 'daily' || t.recurrence.startsWith('days:')) && isDueOn(t, day))
}

export function completionsOn(completions: Completion[], userId: string, day: Ymd): Completion[] {
  return completions.filter((c) => c.user_id === userId && c.due_date === day)
}

/** How many times `task` was completed by `user` in the ISO week containing `day`. */
export function doneThisWeek(task: Task, completions: Completion[], userId: string, day: Ymd): number {
  const { start, end } = weekOf(day)
  return completions.filter(
    (c) => c.task_id === task.id && c.user_id === userId && c.due_date >= start && c.due_date <= end,
  ).length
}

export function isDone(task: Task, completions: Completion[], userId: string, day: Ymd): boolean {
  return completions.some((c) => c.task_id === task.id && c.user_id === userId && c.due_date === day)
}

/** A `once` task is finished when it has any completion by the user. */
export function onceDone(task: Task, completions: Completion[], userId: string): boolean {
  return completions.some((c) => c.task_id === task.id && c.user_id === userId)
}

/**
 * Number of completions the plan expects from one user in the ISO week starting `weekStart`
 * (party goal denominator, spec §6). `once` tasks are excluded — see TODO §0.
 */
export function scheduledInWeek(tasks: Task[], weekStart: Ymd): number {
  let n = 0
  for (const t of tasks) {
    const quota = weeklyQuota(t)
    if (t.recurrence === 'once') continue
    if (quota !== null) {
      const overlaps = [...Array(7).keys()].some((i) => inWindow(t, toYmd(addDays(parseISO(weekStart), i))))
      if (overlaps) n += quota
      continue
    }
    for (let i = 0; i < 7; i++) if (isDueOn(t, toYmd(addDays(parseISO(weekStart), i)))) n++
  }
  return n
}

export type DayStatus = 'empty' | 'partial' | 'full'

/** Calendar marker: any completion → partial; every fixed task done (and ≥1 completion) → full. */
export function dayStatus(tasks: Task[], completions: Completion[], userId: string, day: Ymd): DayStatus {
  const done = completionsOn(completions, userId, day)
  if (done.length === 0) return 'empty'
  const fixed = fixedTasksOn(tasks, day)
  const doneIds = new Set(done.map((c) => c.task_id))
  return fixed.every((t) => doneIds.has(t.id)) ? 'full' : 'partial'
}

/** Backfill window (spec §6): today and the 3 days before it. */
export function canBackfill(day: Ymd, now: Ymd = today()): boolean {
  const gap = differenceInCalendarDays(parseISO(now), parseISO(day))
  return gap >= 0 && gap <= 3
}
