import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRoutine } from './parser'
import {
  canBackfill,
  dayStatus,
  dueList,
  doneThisWeek,
  fixedTasksOn,
  isDueOn,
  scheduledInWeek,
  weekOf,
  weekdayOf,
} from './schedule'
import type { Completion, Task } from './types'

const seed = readFileSync(new URL('../../routine-seed-plan.md', import.meta.url), 'utf8')
const tasks: Task[] = parseRoutine(seed).tasks.map((t, i) => ({ ...t, id: `t${i}`, routine_id: 'r' }))
const byTitle = (title: string, phase?: string) =>
  tasks.find((t) => t.title === title && (!phase || t.phase?.startsWith(phase)))!

const comp = (task: Task, due_date: string, user_id = 'me'): Completion => ({
  id: `${task.id}-${due_date}-${user_id}`,
  task_id: task.id,
  user_id,
  due_date,
  xp_awarded: task.xp,
  completed_at: `${due_date}T08:00:00Z`,
})

describe('weeks', () => {
  it('uses ISO weeks, Monday to Sunday', () => {
    expect(weekOf('2026-09-16')).toEqual({ start: '2026-09-14', end: '2026-09-20' }) // a Wednesday
    expect(weekOf('2026-09-20')).toEqual({ start: '2026-09-14', end: '2026-09-20' }) // Sunday stays
    expect(weekOf('2026-09-21')).toEqual({ start: '2026-09-21', end: '2026-09-27' }) // Monday rolls
    expect(weekdayOf('2026-09-16')).toBe('wed')
  })
})

describe('isDueOn against the seed plan', () => {
  it('respects weekday lists', () => {
    const walk = byTitle('Easy walk 15-20 min')
    expect(isDueOn(walk, '2026-09-16')).toBe(true) // wed
    expect(isDueOn(walk, '2026-09-17')).toBe(false) // thu
    expect(isDueOn(walk, '2026-09-19')).toBe(true) // sat
  })

  it('respects phase windows', () => {
    const walk = byTitle('Easy walk 15-20 min')
    expect(isDueOn(walk, '2026-09-15')).toBe(false) // day before phase 1
    expect(isDueOn(walk, '2026-09-30')).toBe(false) // phase 2, wed but out of window
    const phase2Daily = byTitle('Five-minute minimum', 'Phase 2')
    expect(isDueOn(phase2Daily, '2026-09-29')).toBe(false)
    expect(isDueOn(phase2Daily, '2026-09-30')).toBe(true)
  })

  it('weekly and once tasks are due any day in window', () => {
    const w = byTitle('Walk 25-30 min')
    expect(isDueOn(w, '2026-10-04')).toBe(true) // a Sunday
    const o = byTitle('Sutton and Barto Ch. 1-3')
    expect(isDueOn(o, '2026-09-29')).toBe(true)
    expect(isDueOn(o, '2026-09-30')).toBe(false)
  })

  it('open-ended tasks never expire', () => {
    const t: Task = { ...byTitle('Easy walk 15-20 min'), recurrence: 'daily', ends_on: null }
    expect(isDueOn(t, '2031-01-01')).toBe(true)
  })
})

describe('weekly quota', () => {
  const w = byTitle('Walk 25-30 min')
  it('counts completions inside the ISO week only', () => {
    const cs = [comp(w, '2026-10-05'), comp(w, '2026-10-07'), comp(w, '2026-10-11'), comp(w, '2026-10-12')]
    expect(doneThisWeek(w, cs, 'me', '2026-10-08')).toBe(3) // week of Oct 5–11
    expect(doneThisWeek(w, cs, 'me', '2026-10-12')).toBe(1)
    expect(doneThisWeek(w, cs, 'friend', '2026-10-08')).toBe(0)
  })
})

describe('scheduledInWeek', () => {
  it('sums daily × days, weekday matches and weekly quotas; skips once', () => {
    // Week of 2026-10-05 (Mon) is entirely inside phase 2:
    // Walk 25-30 @weekly:4 → 4, Bodyweight @weekly:2 → 2, Five-minute @daily → 7. RL tasks are all !once.
    expect(scheduledInWeek(tasks, '2026-10-05')).toBe(13)
  })

  it('only counts the days a window covers', () => {
    // Week of 2026-09-14: phase 1 starts Wed 16th → walk on wed/fri/sat = 3, mobility thu = 1, daily 16–20 = 5.
    expect(scheduledInWeek(tasks, '2026-09-14')).toBe(9)
  })
})

describe('dayStatus', () => {
  const day = '2026-09-16' // wed, phase 1: fixed = walk + five-minute
  it('is empty with no completions', () => {
    expect(dayStatus(tasks, [], 'me', day)).toBe('empty')
  })
  it('is partial when some fixed tasks are missing', () => {
    expect(dayStatus(tasks, [comp(byTitle('Easy walk 15-20 min'), day)], 'me', day)).toBe('partial')
  })
  it('is full when every fixed task is done', () => {
    const cs = [comp(byTitle('Easy walk 15-20 min'), day), comp(byTitle('Five-minute minimum (walk around the block)'), day)]
    expect(fixedTasksOn(tasks, day)).toHaveLength(2)
    expect(dayStatus(tasks, cs, 'me', day)).toBe('full')
  })
  it('a day with no fixed tasks is full after any completion', () => {
    const sunday = '2026-11-01' // phase 4: only weekly tasks
    expect(fixedTasksOn(tasks, sunday)).toHaveLength(0)
    expect(dayStatus(tasks, [comp(byTitle('Full-body session'), sunday)], 'me', sunday)).toBe('full')
  })
})

describe('canBackfill', () => {
  it('allows today and the previous three days only', () => {
    expect(canBackfill('2026-09-16', '2026-09-16')).toBe(true)
    expect(canBackfill('2026-09-13', '2026-09-16')).toBe(true)
    expect(canBackfill('2026-09-12', '2026-09-16')).toBe(false)
    expect(canBackfill('2026-09-17', '2026-09-16')).toBe(false)
  })
})

describe('dueList', () => {
  it('hides finished once-tasks and met weekly quotas, keeps today’s done items', () => {
    const day = '2026-10-07' // wed, phase 2
    const walk = byTitle('Walk 25-30 min') // weekly:4
    const once = byTitle('Sutton and Barto Ch. 5-6')
    const daily = byTitle('Five-minute minimum', 'Phase 2')
    const cs = [
      comp(once, '2026-10-05'),
      comp(walk, '2026-10-05'),
      comp(walk, '2026-10-06'),
      comp(walk, '2026-10-06'),
      comp(walk, '2026-10-07'),
    ]
    const titles = dueList(tasks, cs, 'me', day).map((t) => t.title)
    expect(titles).not.toContain(once.title)
    expect(titles).toContain(walk.title) // 4/4 but done today → stays, as done
    expect(titles).toContain(daily.title)
    expect(dueList(tasks, cs, 'me', '2026-10-08').map((t) => t.title)).not.toContain(walk.title)
  })
})
