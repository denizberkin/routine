import { describe, expect, it } from 'vitest'
import type { ParsedTask } from './parser'
import { diffTasks } from './routines'
import type { Task } from './types'

const existing = (id: string, title: string, category: string, sort_order: number): Task => ({
  id,
  routine_id: 'r',
  title,
  category,
  phase: null,
  xp: 10,
  recurrence: 'daily',
  starts_on: '2026-09-16',
  ends_on: null,
  sort_order,
})

const parsed = (title: string, category: string, sort_order: number): ParsedTask => ({
  title,
  category,
  phase: 'P',
  xp: 12,
  recurrence: 'daily',
  starts_on: '2026-09-16',
  ends_on: null,
  sort_order,
  line: sort_order + 1,
})

describe('diffTasks', () => {
  it('keeps ids for unchanged title+category, drops the rest, inserts new', () => {
    const { keep, fresh, drop } = diffTasks(
      [existing('a', 'Walk', 'Exercise', 0), existing('b', 'Read', 'RL', 1)],
      [parsed('Walk', 'Exercise', 0), parsed('Run', 'Exercise', 1)],
    )
    expect(keep.map((t) => t.id)).toEqual(['a'])
    expect(keep[0].xp).toBe(12) // fields refresh, id stays
    expect(fresh.map((t) => t.title)).toEqual(['Run'])
    expect(drop).toEqual(['b'])
  })

  it('matches repeated titles in order', () => {
    const { keep, fresh, drop } = diffTasks(
      [existing('p1', 'Five', 'Exercise', 0), existing('p2', 'Five', 'Exercise', 5), existing('p3', 'Five', 'Exercise', 9)],
      [parsed('Five', 'Exercise', 0), parsed('Five', 'Exercise', 4)],
    )
    expect(keep.map((t) => t.id)).toEqual(['p1', 'p2'])
    expect(fresh).toEqual([])
    expect(drop).toEqual(['p3'])
  })

  it('does not match across categories', () => {
    const { keep, fresh } = diffTasks([existing('a', 'Walk', 'RL', 0)], [parsed('Walk', 'Exercise', 0)])
    expect(keep).toEqual([])
    expect(fresh).toHaveLength(1)
  })
})
