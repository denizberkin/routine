import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useTimer } from '../data/TimerProvider'
import { isDone, today } from '../lib/schedule'
import { fillOf, inkOf } from '../lib/colors'
import { formatClock } from '../lib/timer'

const R = 88
const CIRC = 2 * Math.PI * R

/** Bottom sheet with the countdown ring. Hiding it keeps the timer running; × stops it. */
export default function TimerSheet() {
  const { active, open, remaining, running, finished, pause, resume, addMinutes, dismiss, markDone, hide } = useTimer()
  const { me, slotOf } = useAuth()
  const { tasks, completions } = useData()
  if (!active || !open || !me) return null

  const color = fillOf(slotOf(me.id))
  const ink = inkOf(slotOf(me.id))
  const progress = Math.min(1, Math.max(0, 1 - remaining / active.durationMs))
  const task = tasks.find((t) => t.id === active.taskId)
  const alreadyDone = task ? isDone(task, completions, me.id, today()) : true

  const secondary = 'h-12 flex-1 rounded-xl bg-surface-2 text-sm font-semibold text-ink'

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Hide timer" onClick={hide} className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-label="Timer"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-start gap-3">
          <p className="line-clamp-2 flex-1 text-sm text-ink-2">{active.title}</p>
          <button
            type="button"
            aria-label="Stop timer"
            onClick={dismiss}
            className="-mr-2 -mt-1.5 grid size-9 place-items-center rounded-full text-xl leading-none text-ink-3 hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <div className="relative mx-auto my-6 size-56">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-5xl font-bold tabular-nums tracking-tight"
              style={{ color: finished ? ink : 'var(--ink)' }}
            >
              {formatClock(remaining)}
            </span>
            <span className="mt-1 h-5 text-sm text-ink-2">
              {finished ? 'Time’s up' : running ? '' : 'Paused'}
            </span>
          </div>
        </div>

        {finished ? (
          <div className="flex flex-col gap-2">
            {!alreadyDone && (
              <button
                type="button"
                onClick={markDone}
                className="h-12 w-full rounded-xl text-base font-semibold text-on-accent"
                style={{ background: color }}
              >
                Mark done +{active.xp}
              </button>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => addMinutes(5)} className={secondary}>
                +5 min
              </button>
              <button type="button" onClick={dismiss} className={secondary}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {running ? (
              <button type="button" onClick={pause} className={secondary}>
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={resume}
                className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-ground"
              >
                Resume
              </button>
            )}
            <button type="button" onClick={() => addMinutes(5)} className={secondary}>
              +5 min
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
