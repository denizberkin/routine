import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describeRecurrence, parseRoutine } from './parser'

const seed = readFileSync(new URL('../../routine-seed-plan.md', import.meta.url), 'utf8')

const header = `---
title: Test
start: 2026-09-16
---
`

describe('seed plan', () => {
  const r = parseRoutine(seed)

  it('parses with no errors', () => {
    expect(r.errors).toEqual([])
  })

  it('reads frontmatter', () => {
    expect(r.title).toBe('RL + Exercise Plan')
    expect(r.start).toBe('2026-09-16')
  })

  it('finds every task', () => {
    expect(r.tasks).toHaveLength(27)
    expect(r.tasks.map((t) => t.sort_order)).toEqual([...Array(27).keys()])
  })

  it('applies phase windows and categories', () => {
    const walk = r.tasks.find((t) => t.title === 'Easy walk 15-20 min')!
    expect(walk).toMatchObject({
      category: 'Exercise',
      phase: 'Phase 1: Just show up',
      recurrence: 'days:mon,wed,fri,sat',
      xp: 10,
      starts_on: '2026-09-16',
      ends_on: '2026-09-29',
    })
    const capstone = r.tasks.at(-1)!
    expect(capstone).toMatchObject({
      title: 'Capstone: self-play RL on Tic-Tac-Toe or Connect-4',
      category: 'RL',
      phase: 'Phase 4: Full bandwidth',
      recurrence: 'once',
      xp: 150,
      starts_on: '2026-10-28',
      ends_on: '2026-12-31',
    })
  })

  it('strips tokens from titles', () => {
    for (const t of r.tasks) expect(t.title).not.toMatch(/[@!+]\S/)
  })
})

describe('tokens', () => {
  const one = (line: string) => parseRoutine(`${header}## P\n### C\n${line}\n`)

  it('defaults xp to 10', () => {
    expect(one('- [ ] Walk @daily').tasks[0].xp).toBe(10)
  })

  it('parses weekly quota', () => {
    expect(one('- [ ] Walk @weekly:4 +12').tasks[0]).toMatchObject({ recurrence: 'weekly:4', xp: 12 })
  })

  it('accepts checked boxes too', () => {
    expect(one('- [x] Walk @daily').tasks).toHaveLength(1)
  })

  it('keeps plus signs inside words and on their own', () => {
    expect(one('- [ ] C++ refresher @daily').tasks[0].title).toBe('C++ refresher')
    expect(one('- [ ] policy + value iteration !once +80').tasks[0]).toMatchObject({
      title: 'policy + value iteration',
      xp: 80,
    })
  })

  it('rejects unknown tokens with the line number', () => {
    const r = one('- [ ] Walk @dailyy +5')
    expect(r.tasks).toHaveLength(0)
    expect(r.errors).toEqual([{ line: 7, message: 'Unknown token @dailyy', text: '- [ ] Walk @dailyy +5' }])
  })

  it('rejects a task with no schedule', () => {
    expect(one('- [ ] Walk +5').errors[0].message).toMatch(/needs @daily/)
  })

  it('rejects two schedules', () => {
    expect(one('- [ ] Walk @daily !once').errors[0].message).toMatch(/More than one schedule/)
  })

  it('rejects bad weekday', () => {
    expect(one('- [ ] Walk @mon,funday').errors[0].message).toBe('Unknown token @mon,funday')
  })
})

describe('structure', () => {
  it('requires a category above a task', () => {
    const r = parseRoutine(`${header}## P\n- [ ] Walk @daily\n`)
    expect(r.errors[0].message).toMatch(/### Category/)
  })

  it('falls back to frontmatter start with an open end when there is no window', () => {
    const r = parseRoutine(`${header}## P\n### C\n- [ ] Walk @daily\n`)
    expect(r.tasks[0]).toMatchObject({ starts_on: '2026-09-16', ends_on: null })
  })

  it('errors when neither window nor start exists', () => {
    const r = parseRoutine(`---\ntitle: T\n---\n### C\n- [ ] Walk @daily\n`)
    expect(r.errors[0].message).toMatch(/no "start:"/)
  })

  it('resets the window on a new phase', () => {
    const r = parseRoutine(
      `${header}## A\n> 2026-09-16 -> 2026-09-20\n### C\n- [ ] One @daily\n## B\n### C\n- [ ] Two @daily\n`,
    )
    expect(r.tasks[0].ends_on).toBe('2026-09-20')
    expect(r.tasks[1].ends_on).toBeNull()
  })

  it('rejects a backwards window', () => {
    const r = parseRoutine(`${header}## A\n> 2026-09-20 -> 2026-09-16\n`)
    expect(r.errors[0].message).toMatch(/ends before/)
  })

  it('rejects an invalid date', () => {
    const r = parseRoutine(`${header}## A\n> 2026-02-30 -> 2026-03-01\n`)
    expect(r.errors[0].message).toMatch(/valid YYYY-MM-DD/)
  })

  it('flags stray lines instead of ignoring them', () => {
    const r = parseRoutine(`${header}## A\n### C\n-[ ] typo @daily\n`)
    expect(r.errors[0]).toMatchObject({ line: 7, message: 'Unrecognised line' })
  })

  it('needs a title', () => {
    const r = parseRoutine(`---\nstart: 2026-09-16\n---\n`)
    expect(r.errors[0].message).toMatch(/title/)
  })

  it('handles CRLF input', () => {
    const r = parseRoutine(`${header}## A\r\n### C\r\n- [ ] Walk @daily\r\n`.replace(/\n/g, '\r\n'))
    expect(r.errors).toEqual([])
    expect(r.tasks).toHaveLength(1)
  })
})

describe('describeRecurrence', () => {
  it('reads naturally', () => {
    expect(describeRecurrence('daily')).toBe('every day')
    expect(describeRecurrence('once')).toBe('once')
    expect(describeRecurrence('weekly:3')).toBe('3× a week')
    expect(describeRecurrence('days:mon,wed,fri')).toBe('mon wed fri')
  })
})

describe('split plans', () => {
  const exercise = parseRoutine(readFileSync(new URL('../../plans/exercise.md', import.meta.url), 'utf8'))
  const rl = parseRoutine(readFileSync(new URL('../../plans/rl.md', import.meta.url), 'utf8'))

  it('both parse clean and add up to the seed', () => {
    expect(exercise.errors).toEqual([])
    expect(rl.errors).toEqual([])
    expect(exercise.tasks.length + rl.tasks.length).toBe(27)
    expect(exercise.tasks.every((t) => t.category === 'Exercise')).toBe(true)
    expect(rl.tasks.every((t) => t.category === 'RL')).toBe(true)
  })
})

describe('~N timer token', () => {
  const one = (line: string) => parseRoutine(`${header}## P\n### C\n${line}\n`)
  it('reads minutes in any of the accepted spellings', () => {
    expect(one('- [ ] Walk @daily ~15').tasks[0].duration_min).toBe(15)
    expect(one('- [ ] Walk @daily ~15m').tasks[0].duration_min).toBe(15)
    expect(one('- [ ] Walk @daily ~15min +5').tasks[0]).toMatchObject({ duration_min: 15, xp: 5 })
    expect(one('- [ ] Walk @daily').tasks[0].duration_min).toBeNull()
  })
  it('keeps a lone tilde in the title and rejects junk', () => {
    expect(one('- [ ] Walk ~ jog @daily').tasks[0].title).toBe('Walk ~ jog')
    expect(one('- [ ] Walk @daily ~abc').errors[0].message).toBe('Unknown token ~abc')
    expect(one('- [ ] Walk @daily ~0').errors[0].message).toMatch(/between 1 and 600/)
  })
})
