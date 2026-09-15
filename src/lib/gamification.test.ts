import { describe, expect, it } from 'vitest'
import { levelFor, stepXp, streak, totalXp } from './gamification'
import type { Completion } from './types'

const on = (days: string[], user_id = 'me'): Completion[] =>
  days.map((d, i) => ({
    id: `${user_id}-${i}`,
    task_id: 't',
    user_id,
    due_date: d,
    xp_awarded: 10,
    completed_at: `${d}T08:00:00Z`,
  }))

describe('levels', () => {
  it('steps grow quadratically', () => {
    expect([1, 2, 3, 4].map(stepXp)).toEqual([100, 300, 600, 1000])
  })

  it('derives level and progress from total xp', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, into: 0, need: 100 })
    expect(levelFor(99)).toMatchObject({ level: 1, into: 99, need: 100 })
    expect(levelFor(100)).toMatchObject({ level: 2, into: 0, need: 300 })
    expect(levelFor(399)).toMatchObject({ level: 2, into: 299 })
    expect(levelFor(400)).toMatchObject({ level: 3, into: 0, need: 600 })
    expect(levelFor(1000)).toMatchObject({ level: 4, into: 0, need: 1000 })
    expect(levelFor(1500).progress).toBeCloseTo(0.5)
  })

  it('sums only the user’s xp', () => {
    expect(totalXp([...on(['2026-09-16']), ...on(['2026-09-16'], 'friend')], 'me')).toBe(10)
  })
})

// 2026-09-14 is a Monday. Week A = 14–20, week B = 21–27.
describe('streak', () => {
  it('is 0 with nothing done', () => {
    expect(streak([], 'me', '2026-09-16')).toBe(0)
  })

  it('counts consecutive active days ending today', () => {
    expect(streak(on(['2026-09-14', '2026-09-15', '2026-09-16']), 'me', '2026-09-16')).toBe(3)
  })

  it('does not break while today is still pending', () => {
    expect(streak(on(['2026-09-14', '2026-09-15']), 'me', '2026-09-16')).toBe(2)
  })

  it('forgives one missed day per week without counting it', () => {
    // Mon, Tue, (Wed missed), Thu
    expect(streak(on(['2026-09-14', '2026-09-15', '2026-09-17']), 'me', '2026-09-17')).toBe(3)
  })

  it('resets on the second miss in the same week', () => {
    // Mon, (Tue, Wed missed), Thu
    expect(streak(on(['2026-09-14', '2026-09-17']), 'me', '2026-09-17')).toBe(1)
  })

  it('a pending today plus one missed day still keeps the run', () => {
    // Mon active, Tue missed (grace), Wed pending
    expect(streak(on(['2026-09-14']), 'me', '2026-09-16')).toBe(1)
    // Mon active, Tue + Wed missed, Thu pending → gone
    expect(streak(on(['2026-09-14']), 'me', '2026-09-17')).toBe(0)
  })

  it('grace resets at the ISO week boundary', () => {
    // Fri 18, (Sat 19 missed: week A grace), Sun 20, (Mon 21 missed: week B grace), Tue 22
    expect(streak(on(['2026-09-18', '2026-09-20', '2026-09-22']), 'me', '2026-09-22')).toBe(3)
    // …but a second miss inside week B ends it: Fri 18, Sat 19, Sun 20, (Mon 21, Tue 22 missed), Wed 23
    expect(streak(on(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-23']), 'me', '2026-09-23')).toBe(1)
  })

  it('ignores the other user', () => {
    expect(streak(on(['2026-09-16'], 'friend'), 'me', '2026-09-16')).toBe(0)
  })
})
