import { describe, expect, it } from 'vitest'
import { achievements, bestStreak, clearedPhases, hasComeback } from './achievements'
import type { Completion, Task } from './types'

const task = (id: string, category: string, recurrence: Task['recurrence'], phase = 'P1'): Task => ({
  id,
  routine_id: 'r',
  title: id,
  category,
  phase,
  xp: 10,
  recurrence,
  duration_min: null,
  starts_on: '2026-09-01',
  ends_on: null,
  sort_order: 0,
})

const comp = (task_id: string, due_date: string, user_id = 'me', hour = 9): Completion => ({
  id: `${task_id}-${due_date}-${user_id}`,
  task_id,
  user_id,
  due_date,
  xp_awarded: 10,
  completed_at: new Date(`${due_date}T${String(hour).padStart(2, '0')}:00:00`).toISOString(),
})

const days = (from: number, to: number, task_id = 'walk', user_id = 'me') =>
  Array.from({ length: to - from + 1 }, (_, i) => comp(task_id, `2026-09-${String(from + i).padStart(2, '0')}`, user_id))

const tasks = [task('walk', 'Exercise', 'daily'), task('read', 'RL', 'once'), task('build', 'RL', 'once'), task('p2', 'RL', 'once', 'P2')]

describe('bestStreak', () => {
  it('remembers a streak that has since been lost', () => {
    const cs = [...days(1, 8), comp('walk', '2026-09-20')]
    expect(bestStreak(cs, 'me', '2026-09-20')).toBe(8)
  })
})

describe('hasComeback', () => {
  it('needs three or more empty days between active ones', () => {
    expect(hasComeback([comp('walk', '2026-09-01'), comp('walk', '2026-09-05')], 'me')).toBe(true)
    expect(hasComeback([comp('walk', '2026-09-01'), comp('walk', '2026-09-04')], 'me')).toBe(false)
  })
})

describe('clearedPhases', () => {
  it('lists phases whose once-tasks are all done', () => {
    expect(clearedPhases(tasks, [comp('read', '2026-09-02')], 'me')).toEqual([])
    expect(clearedPhases(tasks, [comp('read', '2026-09-02'), comp('build', '2026-09-03')], 'me')).toEqual(['P1'])
  })
})

describe('achievements', () => {
  it('starts fully locked with progress counters', () => {
    const b = achievements(tasks, [], 'me', 'friend', '2026-09-15')
    expect(b).toHaveLength(9)
    expect(b.every((x) => !x.unlocked)).toBe(true)
    expect(b.find((x) => x.id === 'scholar')?.progress).toEqual({ done: 0, need: 10 })
  })

  it('unlocks the right ones', () => {
    const cs = [
      ...days(1, 7), // 7-day streak
      ...Array.from({ length: 10 }, (_, i) => comp('read', `2026-08-${String(i + 1).padStart(2, '0')}`, 'me', 6)), // early + scholar
      comp('build', '2026-09-08'),
      ...days(1, 10, 'walk', 'friend'), // in sync: Sep 1–8 overlap
    ]
    const ids = achievements(tasks, cs, 'me', 'friend', '2026-09-15')
      .filter((b) => b.unlocked)
      .map((b) => b.id)
    expect(ids).toEqual(expect.arrayContaining(['first_step', 'consistent', 'early_bird', 'scholar', 'phase_clear', 'comeback']))
    expect(ids).not.toContain('committed')
    expect(ids).not.toContain('mover')
    const sync = achievements(tasks, cs, 'me', 'friend', '2026-09-15').find((b) => b.id === 'in_sync')!
    expect(sync).toMatchObject({ unlocked: false, progress: { done: 8, need: 10 } })
  })
})
