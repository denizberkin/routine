import { useTimer } from '../data/TimerProvider'
import { describeRecurrence } from '../lib/parser'
import { formatClock, formatMinutes, resolveMinutes } from '../lib/timer'
import type { Task } from '../lib/types'

interface Props {
  task: Task | null
  done: boolean
  xp: number
  color: string
  onToggle: () => void
  onClose: () => void
}

/** Bottom sheet for one task: start its timer, or mark it done without one. */
export default function TaskSheet({ task, done, xp, color, onToggle, onClose }: Props) {
  const timer = useTimer()
  if (!task) return null

  const minutes = resolveMinutes(task)
  const running = timer.active?.taskId === task.id
  const secondary = 'h-12 flex-1 rounded-xl bg-surface-2 text-sm font-semibold text-ink'

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-label={task.title}
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="text-lg font-semibold leading-snug">{task.title}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {task.category}
          {task.phase && ` — ${task.phase}`}
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-ink-3">
          {describeRecurrence(task.recurrence)}, {formatMinutes(minutes)}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {running ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                timer.show()
              }}
              className="h-12 w-full rounded-xl text-base font-semibold tabular-nums text-on-accent"
              style={{ background: color }}
            >
              {timer.finished ? 'Time’s up' : `${formatClock(timer.remaining)} running`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose()
                timer.start(task, minutes)
              }}
              className="h-12 w-full rounded-xl text-base font-semibold text-on-accent"
              style={{ background: color }}
            >
              Start {minutes} min timer
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onToggle()
                onClose()
              }}
              className={secondary}
            >
              {done ? 'Undo' : `Mark done +${xp}`}
            </button>
            <button type="button" onClick={onClose} className={secondary}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
