import { isValid, parseISO } from 'date-fns'
import type { Recurrence } from './types'

/*
  Markdown routine format (spec §5):

  ---
  title: RL + Exercise Plan
  start: 2026-09-16
  ---
  ## Phase 1: Just show up
  > 2026-09-16 -> 2026-09-29
  ### Exercise
  - [ ] Easy walk 15-20 min @mon,wed,fri,sat +10
  - [ ] Five-minute minimum @daily +3
  ### RL
  - [ ] Sutton & Barto Ch. 1-3 !once +50

  Tokens: @daily | @mon,wed,… | @weekly:N | !once | +N (xp, default 10)
  Strict on purpose: every non-blank line must be recognised or it becomes an error.
*/

export interface ParsedTask {
  title: string
  category: string
  phase: string | null
  xp: number
  recurrence: Recurrence
  starts_on: string
  ends_on: string | null
  sort_order: number
  line: number
}

export interface ParseError {
  line: number
  message: string
  text: string
}

export interface ParsedRoutine {
  title: string
  start: string | null
  tasks: ParsedTask[]
  errors: ParseError[]
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_RE = /^>\s*(\S+)\s*->\s*(\S+)\s*$/
const TASK_RE = /^-\s+\[( |x|X)\]\s*(.*)$/

function isDate(s: string): boolean {
  return DATE_RE.test(s) && isValid(parseISO(s))
}

/** Parse a task line's tail into tokens; returns an error message or the task fields. */
function parseTaskText(text: string): { title: string; xp: number; recurrence: Recurrence } | string {
  const words = text.split(/\s+/).filter(Boolean)
  const titleWords: string[] = []
  let recurrence: Recurrence | null = null
  let xp: number | null = null

  for (const w of words) {
    const first = w[0]
    // A sigil on its own ("+", "!") is just punctuation in the title.
    if ((first !== '@' && first !== '!' && first !== '+') || w.length === 1) {
      titleWords.push(w)
      continue
    }
    let next: Recurrence | null = null
    if (w === '@daily') next = 'daily'
    else if (w === '!once') next = 'once'
    else if (/^@weekly:\d+$/.test(w)) {
      const n = Number(w.slice('@weekly:'.length))
      if (n < 1 || n > 7) return `@weekly:N needs N between 1 and 7`
      next = `weekly:${n}`
    } else if (first === '@') {
      const days = w.slice(1).toLowerCase().split(',')
      const bad = days.find((d) => !(WEEKDAYS as readonly string[]).includes(d))
      if (bad !== undefined) return `Unknown token ${w}`
      next = `days:${[...new Set(days)].join(',')}`
    } else if (/^\+\d+$/.test(w)) {
      if (xp !== null) return `More than one +N value`
      xp = Number(w.slice(1))
      continue
    } else {
      return `Unknown token ${w}`
    }
    if (recurrence !== null) return `More than one schedule token (${recurrence} and ${w})`
    recurrence = next
  }

  const title = titleWords.join(' ').trim()
  if (!title) return 'Task has no title'
  if (recurrence === null) return 'Task needs @daily, @mon,wed,…, @weekly:N or !once'
  return { title, xp: xp ?? 10, recurrence }
}

export function parseRoutine(markdown: string): ParsedRoutine {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const errors: ParseError[] = []
  const tasks: ParsedTask[] = []
  const fail = (line: number, message: string) =>
    errors.push({ line, message, text: lines[line - 1] ?? '' })

  let title = ''
  let start: string | null = null
  let i = 0

  // Frontmatter
  if (lines[0]?.trim() === '---') {
    let closed = false
    for (i = 1; i < lines.length; i++) {
      const raw = lines[i]
      if (raw.trim() === '---') {
        closed = true
        i++
        break
      }
      const m = /^(\w+)\s*:\s*(.*?)\s*$/.exec(raw)
      if (!m) {
        if (raw.trim()) fail(i + 1, 'Frontmatter lines look like key: value')
        continue
      }
      const [, key, value] = m
      if (key === 'title') title = value
      else if (key === 'start') {
        if (isDate(value)) start = value
        else fail(i + 1, `start must be YYYY-MM-DD, got "${value}"`)
      } else fail(i + 1, `Unknown frontmatter key "${key}"`)
    }
    if (!closed) fail(1, 'Frontmatter never closed with ---')
  }
  if (!title) fail(1, 'Missing "title:" in frontmatter')

  let phase: string | null = null
  let category: string | null = null
  let windowStart: string | null = null
  let windowEnd: string | null = null

  for (; i < lines.length; i++) {
    const raw = lines[i]
    const line = i + 1
    const text = raw.trim()
    if (!text) continue

    if (text.startsWith('### ')) {
      category = text.slice(4).trim() || null
      if (!category) fail(line, 'Category heading is empty')
      continue
    }
    if (text.startsWith('## ')) {
      phase = text.slice(3).trim() || null
      if (!phase) fail(line, 'Phase heading is empty')
      category = null
      windowStart = null
      windowEnd = null
      continue
    }
    if (text.startsWith('>')) {
      const m = WINDOW_RE.exec(text)
      if (!m) {
        fail(line, 'Window must be "> YYYY-MM-DD -> YYYY-MM-DD"')
        continue
      }
      const [, a, b] = m
      if (!isDate(a) || !isDate(b)) fail(line, 'Window dates must be valid YYYY-MM-DD')
      else if (b < a) fail(line, 'Window ends before it starts')
      else {
        windowStart = a
        windowEnd = b
      }
      continue
    }
    const tm = TASK_RE.exec(text)
    if (tm) {
      if (!category) {
        fail(line, 'Task needs a "### Category" heading above it')
        continue
      }
      const parsed = parseTaskText(tm[2])
      if (typeof parsed === 'string') {
        fail(line, parsed)
        continue
      }
      const starts_on = windowStart ?? start
      if (!starts_on) {
        fail(line, 'No "> start -> end" window and no "start:" in frontmatter')
        continue
      }
      tasks.push({
        ...parsed,
        category,
        phase,
        starts_on,
        ends_on: windowStart ? windowEnd : null,
        sort_order: tasks.length,
        line,
      })
      continue
    }
    fail(line, 'Unrecognised line')
  }

  return { title, start, tasks, errors }
}

/** Human-readable recurrence, for the preview table and task rows. */
export function describeRecurrence(r: Recurrence): string {
  if (r === 'daily') return 'every day'
  if (r === 'once') return 'once'
  if (r.startsWith('weekly:')) return `${r.slice(7)}× a week`
  return r.slice(5).split(',').join(' ')
}
