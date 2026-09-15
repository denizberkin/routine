import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfISOWeek, endOfMonth, format, parseISO, startOfISOWeek, startOfMonth } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import AvatarMenu from '../components/AvatarMenu'
import TaskRow from '../components/TaskRow'
import { useData } from '../data/DataProvider'
import { useToday } from '../data/useToday'
import { fillOf, inkOf } from '../lib/colors'
import { awardFor } from '../lib/gamification'
import { canBackfill, dayStatus, dueList, isDone, toYmd } from '../lib/schedule'
import type { DayStatus, Ymd } from '../lib/schedule'
import type { Completion, Profile, Task } from '../lib/types'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function Calendar() {
  const { me, friend, slotOf } = useAuth()
  const { tasks, completions, complete, uncomplete } = useData()
  const now = useToday()
  const [month, setMonth] = useState(() => startOfMonth(parseISO(now)))
  const [selected, setSelected] = useState<Ymd>(now)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfISOWeek(month), end: endOfISOWeek(endOfMonth(month)) }).map(toYmd),
    [month],
  )

  // Both people, in fixed color order, so the two marks under each day always read the same way.
  const people = useMemo(() => {
    const list = [me, friend].filter((p): p is Profile => p !== null)
    return list.sort((a, b) => (slotOf(a.id) === 'u1' ? -1 : slotOf(b.id) === 'u1' ? 1 : 0))
  }, [me, friend, slotOf])

  const marks = useMemo(() => {
    const m = new Map<Ymd, DayStatus[]>()
    for (const d of days) m.set(d, people.map((p) => dayStatus(tasks, completions, p.id, d)))
    return m
  }, [days, people, tasks, completions])

  if (!me) return null
  const monthKey = format(month, 'yyyy-MM')

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Calendar</h1>
        <AvatarMenu />
      </header>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface"
        >
          <Chevron dir="left" />
        </button>
        <span className="font-semibold">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-semibold text-ink-3">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.startsWith(monthKey)
          const isToday = d === now
          const isSelected = d === selected
          const future = d > now
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={isSelected}
              aria-label={format(parseISO(d), 'EEEE d MMMM')}
              className={`flex h-14 flex-col items-center justify-between rounded-xl pb-2 pt-1.5 transition-colors ${
                isSelected ? 'bg-surface' : 'hover:bg-surface/60'
              }`}
            >
              <span
                className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${
                  isToday ? 'bg-ink font-bold text-ground' : inMonth && !future ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {Number(d.slice(8))}
              </span>
              <span className="flex gap-1" aria-hidden>
                {people.map((p, i) => (
                  <Mark key={p.id} status={marks.get(d)?.[i] ?? 'empty'} color={fillOf(slotOf(p.id))} faint={future} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <DayPanel
        day={selected}
        now={now}
        me={me}
        friend={friend}
        color={fillOf(slotOf(me.id))}
        ink={inkOf(slotOf(me.id))}
        friendColor={friend ? fillOf(slotOf(friend.id)) : ''}
        friendInk={friend ? inkOf(slotOf(friend.id)) : ''}
        tasks={tasks}
        completions={completions}
        onComplete={(t) => complete(t, selected)}
        onUncomplete={(t) => uncomplete(t, selected)}
      />
    </div>
  )
}

function Mark({ status, color, faint }: { status: DayStatus; color: string; faint: boolean }) {
  const background =
    status === 'full' ? color : status === 'partial' ? `color-mix(in srgb, ${color} 45%, transparent)` : 'var(--surface-2)'
  return <span className="h-1.5 w-4 rounded-full" style={{ background, opacity: faint ? 0.5 : 1 }} />
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'left' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'} />
    </svg>
  )
}

function DayPanel({
  day,
  now,
  me,
  friend,
  color,
  ink,
  friendColor,
  friendInk,
  tasks,
  completions,
  onComplete,
  onUncomplete,
}: {
  day: Ymd
  now: Ymd
  me: Profile
  friend: Profile | null
  color: string
  ink: string
  friendColor: string
  friendInk: string
  tasks: Task[]
  completions: Completion[]
  onComplete: (t: Task) => void
  onUncomplete: (t: Task) => void
}) {
  const future = day > now
  const past = day < now
  const editable = !future && canBackfill(day, now)
  const note = future ? 'Upcoming' : past && editable ? 'Past day, half XP' : past ? 'Read only' : ''

  const awardedFor = (t: Task, userId: string) =>
    completions.find((c) => c.task_id === t.id && c.user_id === userId && c.due_date === day)?.xp_awarded

  const sections: { person: Profile; c: string; i: string; mine: boolean }[] = [
    { person: me, c: color, i: ink, mine: true },
    ...(friend ? [{ person: friend, c: friendColor, i: friendInk, mine: false }] : []),
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{format(parseISO(day), 'EEEE d MMM')}</h2>
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </div>
      {sections.map(({ person, c, i, mine }) => {
        const list = dueList(tasks, completions, person.id, day)
        return (
          <div key={person.id}>
            <div className="mb-1 flex items-center gap-2 px-2 text-sm font-semibold text-ink-2">
              <span aria-hidden>{person.avatar_emoji}</span>
              {person.display_name}
            </div>
            {list.length === 0 ? (
              <p className="px-2 py-2 text-sm text-ink-3">Nothing due.</p>
            ) : (
              <div className="-mx-2 flex flex-col">
                {list.map((t) => {
                  const done = isDone(t, completions, person.id, day)
                  return (
                    <TaskRow
                      key={t.id}
                      title={t.title}
                      xp={awardedFor(t, person.id) ?? (mine ? awardFor(t, day, completions, me.id, now) : t.xp)}
                      done={done}
                      color={c}
                      ink={i}
                      readOnly={!mine || !editable}
                      onToggle={() => (done ? onUncomplete(t) : onComplete(t))}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
