import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import AvatarMenu from '../components/AvatarMenu'
import BadgesSheet from '../components/BadgesSheet'
import TaskRow from '../components/TaskRow'
import TaskSheet from '../components/TaskSheet'
import { useData } from '../data/DataProvider'
import { useTimer } from '../data/TimerProvider'
import { useToday } from '../data/useToday'
import {
  PARTY_BONUS,
  SAME_DAY_BONUS,
  awardFor,
  levelFor,
  multiplier,
  partyWeek,
  sameDays,
  streak,
  xpSummary,
} from '../lib/gamification'
import { fillOf, inkOf } from '../lib/colors'
import { doneThisWeek, dueList, isDone, weekOf, weeklyQuota } from '../lib/schedule'
import type { Ymd } from '../lib/schedule'
import { formatClock, formatMinutes, resolveMinutes } from '../lib/timer'
import type { Completion, DayNote, Profile, Task } from '../lib/types'

export default function Today() {
  const { me, friend, slotOf } = useAuth()
  const { loading, tasks, completions, notes, complete, uncomplete, poke } = useData()
  const timer = useTimer()
  const day = useToday()
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [openTask, setOpenTask] = useState<Task | null>(null)

  const myId = me?.id ?? ''
  const mine = useMemo(() => dueList(tasks, completions, myId, day), [tasks, completions, myId, day])
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of mine) map.set(t.category, [...(map.get(t.category) ?? []), t])
    return [...map]
  }, [mine])

  if (!me) return null
  const color = fillOf(slotOf(me.id))
  const ink = inkOf(slotOf(me.id))
  const friendColor = friend ? fillOf(slotOf(friend.id)) : color
  const friendInk = friend ? inkOf(slotOf(friend.id)) : ink
  const xp = xpSummary(tasks, completions, me.id, friend?.id ?? null, day)
  const level = levelFor(xp.total)
  const fire = streak(completions, me.id, day)
  const mult = multiplier(fire)
  const bothToday = friend ? sameDays(completions, me.id, friend.id).includes(day) : false
  const party = friend && tasks.length ? partyWeek(tasks, completions, weekOf(day).start) : null

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="flex items-center gap-3">
          <AvatarMenu align="left" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold leading-tight">{me.display_name}</div>
            <div className="text-xs text-ink-3">{format(parseISO(day), 'EEEE d MMM')}</div>
          </div>
          <button
            type="button"
            onClick={() => setBadgesOpen(true)}
            aria-label={`Level ${level.level}. Achievements`}
            className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums transition-transform active:scale-95"
            style={{ color: ink, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
          >
            Lv {level.level}
          </button>
        </div>
        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(2, level.progress * 100)}%`, background: color }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-2">
          <span>
            {level.into} / {level.need} XP
          </span>
          <span>
            🔥 {fire}
            {mult > 1 && (
              <span className="ml-1.5 font-semibold" style={{ color: ink }}>
                ×{mult}
              </span>
            )}
          </span>
        </div>
      </header>

      <BadgesSheet open={badgesOpen} onClose={() => setBadgesOpen(false)} />

      {friend && (
        <FriendCard
          me={me}
          friend={friend}
          color={friendColor}
          ink={friendInk}
          myColor={color}
          myInk={ink}
          list={dueList(tasks, completions, friend.id, day)}
          completions={completions}
          notes={notes}
          day={day}
          bothToday={bothToday}
          myDoneToday={mine.filter((t) => isDone(t, completions, me.id, day)).length}
          onPoke={poke}
        />
      )}

      {party && party.target > 0 && <PartyBar party={party} a={color} b={friendColor} />}

      {loading ? null : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-16 text-center">
          <p className="text-ink-2">Nothing planned yet.</p>
          <Link to="/plan" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ground">
            Add a plan
          </Link>
        </div>
      ) : mine.length === 0 ? (
        <p className="pt-16 text-center text-ink-2">Nothing due today.</p>
      ) : (
        groups.map(([category, list]) => {
          const left = list
            .filter((t) => !isDone(t, completions, me.id, day))
            .reduce((sum, t) => sum + resolveMinutes(t), 0)
          return (
            <section key={category}>
              <div className="mb-1 flex items-baseline justify-between px-2">
                <h2 className="text-sm font-semibold text-ink-2">{category}</h2>
                <span className="text-xs tabular-nums" style={{ color: left ? 'var(--ink-3)' : ink }}>
                  {left ? `${formatMinutes(left)} left` : 'done'}
                </span>
              </div>
              <div className="-mx-2 flex flex-col">
                {list.map((task) => {
                  const done = isDone(task, completions, me.id, day)
                  const quota = weeklyQuota(task)
                  const awarded = completions.find(
                    (c) => c.task_id === task.id && c.user_id === me.id && c.due_date === day,
                  )?.xp_awarded
                  const timing = timer.active?.taskId === task.id
                  const when =
                    quota !== null
                      ? `, ${doneThisWeek(task, completions, me.id, day)}/${quota} this week`
                      : task.recurrence === 'once'
                        ? ', once'
                        : ''
                  return (
                    <TaskRow
                      key={task.id}
                      title={task.title}
                      meta={(timing ? formatClock(timer.remaining) : formatMinutes(resolveMinutes(task))) + when}
                      metaActive={timing}
                      xp={awarded ?? awardFor(task, day, completions, me.id, day)}
                      done={done}
                      color={color}
                      ink={ink}
                      onToggle={() => (done ? uncomplete(task, day) : complete(task, day))}
                      onOpen={() => setOpenTask(task)}
                    />
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      <TaskSheet
        task={openTask}
        done={openTask ? isDone(openTask, completions, me.id, day) : false}
        xp={openTask ? awardFor(openTask, day, completions, me.id, day) : 0}
        color={color}
        onToggle={() => {
          if (!openTask) return
          if (isDone(openTask, completions, me.id, day)) uncomplete(openTask, day)
          else complete(openTask, day)
        }}
        onClose={() => setOpenTask(null)}
      />
    </div>
  )
}

function FriendCard({
  me,
  friend,
  color,
  ink,
  myColor,
  myInk,
  list,
  completions,
  notes,
  day,
  bothToday,
  myDoneToday,
  onPoke,
}: {
  me: Profile
  friend: Profile
  color: string
  ink: string
  myColor: string
  myInk: string
  list: Task[]
  completions: Completion[]
  notes: DayNote[]
  day: Ymd
  bothToday: boolean
  myDoneToday: number
  onPoke: () => void
}) {
  const done = list.filter((t) => isDone(t, completions, friend.id, day)).length
  const fire = streak(completions, friend.id, day)
  const pokedThem = notes.some((n) => n.user_id === me.id && n.day === day && n.body === 'poke')
  const pokedMe = notes.some((n) => n.user_id === friend.id && n.day === day && n.body === 'poke')
  const canPoke = done === 0 && list.length > 0 && new Date().getHours() >= 12 && !pokedThem

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[22px] leading-none" aria-hidden>
          {friend.avatar_emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{friend.display_name}</div>
          {list.length > 0 && (
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {list.map((t) => (
                <span
                  key={t.id}
                  className="h-1.5 w-4 rounded-full transition-colors duration-300"
                  style={{ background: isDone(t, completions, friend.id, day) ? color : 'var(--surface-2)' }}
                />
              ))}
            </div>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color: ink }}>
          {done}/{list.length}
        </span>
        <span className="text-sm tabular-nums text-ink-2">🔥 {fire}</span>
        {canPoke && (
          <button
            type="button"
            onClick={onPoke}
            className="ml-1 h-8 rounded-full px-3 text-xs font-semibold text-on-accent"
            style={{ background: myColor }}
          >
            Poke
          </button>
        )}
        {pokedThem && done === 0 && <span className="ml-1 text-xs text-ink-3">Poked</span>}
      </div>
      {(bothToday || (pokedMe && myDoneToday === 0)) && (
        <div className="flex flex-col gap-1 text-sm">
          {bothToday && (
            <span>
              Both in today 🤝{' '}
              <span
                className="font-semibold"
                style={{ background: `linear-gradient(90deg, ${myInk}, ${ink})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
              >
                +{SAME_DAY_BONUS}
              </span>
            </span>
          )}
          {pokedMe && myDoneToday === 0 && (
            <span className="text-ink-2">
              {friend.avatar_emoji} {friend.display_name} poked you
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function PartyBar({ party, a, b }: { party: ReturnType<typeof partyWeek>; a: string; b: string }) {
  const pct = Math.min(100, (party.done / party.target) * 100)
  return (
    <div className="px-1">
      <div className="flex items-baseline justify-between text-xs text-ink-2">
        <span>This week together</span>
        <span className="tabular-nums">
          {party.hit ? (
            <span className="font-semibold text-ink">Goal hit +{PARTY_BONUS}</span>
          ) : (
            <>
              {party.done} / {party.target}
            </>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(party.done ? 3 : 0, pct)}%`, background: `linear-gradient(90deg, ${a}, ${b})` }}
        />
      </div>
    </div>
  )
}
