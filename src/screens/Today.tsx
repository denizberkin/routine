import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import AvatarMenu from '../components/AvatarMenu'
import TaskRow from '../components/TaskRow'
import { useData } from '../data/DataProvider'
import { useToday } from '../data/useToday'
import { levelFor, streak, totalXp } from '../lib/gamification'
import { doneThisWeek, dueList, isDone, weeklyQuota } from '../lib/schedule'
import type { Ymd } from '../lib/schedule'
import type { Completion, Profile, Task } from '../lib/types'

export default function Today() {
  const { me, friend, slotOf } = useAuth()
  const { loading, tasks, completions, complete, uncomplete } = useData()
  const day = useToday()

  const myId = me?.id ?? ''
  const mine = useMemo(() => dueList(tasks, completions, myId, day), [tasks, completions, myId, day])
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of mine) map.set(t.category, [...(map.get(t.category) ?? []), t])
    return [...map]
  }, [mine])

  if (!me) return null
  const color = `var(--${slotOf(me.id)})`
  const level = levelFor(totalXp(completions, me.id))
  const fire = streak(completions, me.id, day)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="flex items-center gap-3">
          <AvatarMenu align="left" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold leading-tight">{me.display_name}</div>
            <div className="text-xs text-ink-3">{format(parseISO(day), 'EEEE d MMM')}</div>
          </div>
          <div
            className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
            style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
          >
            Lv {level.level}
          </div>
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
          <span>🔥 {fire}</span>
        </div>
      </header>

      {friend && (
        <FriendCard
          friend={friend}
          color={`var(--${slotOf(friend.id)})`}
          list={dueList(tasks, completions, friend.id, day)}
          completions={completions}
          day={day}
        />
      )}

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
        groups.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-1 px-2 text-sm font-semibold text-ink-2">{category}</h2>
            <div className="-mx-2 flex flex-col">
              {list.map((task) => {
                const done = isDone(task, completions, me.id, day)
                const quota = weeklyQuota(task)
                const awarded = completions.find(
                  (c) => c.task_id === task.id && c.user_id === me.id && c.due_date === day,
                )?.xp_awarded
                return (
                  <TaskRow
                    key={task.id}
                    title={task.title}
                    meta={
                      quota !== null
                        ? `${doneThisWeek(task, completions, me.id, day)}/${quota} this week`
                        : task.recurrence === 'once'
                          ? 'once'
                          : undefined
                    }
                    xp={awarded ?? task.xp}
                    done={done}
                    color={color}
                    onToggle={() => (done ? uncomplete(task, day) : complete(task, day, task.xp))}
                  />
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function FriendCard({
  friend,
  color,
  list,
  completions,
  day,
}: {
  friend: Profile
  color: string
  list: Task[]
  completions: Completion[]
  day: Ymd
}) {
  const done = list.filter((t) => isDone(t, completions, friend.id, day)).length
  const fire = streak(completions, friend.id, day)
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
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
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>
        {done}/{list.length}
      </span>
      <span className="text-sm tabular-nums text-ink-2">🔥 {fire}</span>
    </div>
  )
}
