import { useState } from 'react'

interface Props {
  title: string
  /** Small line under the title, e.g. "2/4 this week" */
  meta?: string
  xp: number
  done: boolean
  /** CSS color for the checkbox fill and XP — the acting user's slot color */
  color: string
  /** Label for the timer chip ("15m", or a live "12:34" while that timer runs) */
  timerLabel?: string
  timerActive?: boolean
  onTimer?: () => void
  disabled?: boolean
  onToggle: () => void
}

/** One task. The row is the checkbox; the small chip on the right opens a timer for it. */
export default function TaskRow({ title, meta, xp, done, color, timerLabel, timerActive, onTimer, disabled, onToggle }: Props) {
  const [floating, setFloating] = useState(0)

  function toggle() {
    if (!done) setFloating((n) => n + 1)
    onToggle()
  }

  return (
    <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={disabled}
        onClick={toggle}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-row px-2 py-3 text-left transition-colors active:bg-surface disabled:opacity-50"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-200"
          style={{ borderColor: done ? color : 'var(--line)', background: done ? color : 'transparent' }}
        >
          {done && (
            <svg viewBox="0 0 16 16" className="size-4 animate-pop" fill="none" stroke="var(--ground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block line-clamp-2 text-[17px] font-medium leading-6 transition-colors duration-200 ${done ? 'text-ink-3' : 'text-ink'}`}>
            {title}
          </span>
          {meta && <span className="block text-xs text-ink-3">{meta}</span>}
        </span>
      </button>

      {onTimer && timerLabel && (
        <button
          type="button"
          onClick={onTimer}
          aria-label={timerActive ? 'Show timer' : `Start ${timerLabel} timer`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums transition-colors hover:bg-surface-2"
          style={{ color: timerActive ? color : 'var(--ink-3)' }}
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </svg>
          {timerLabel}
        </button>
      )}

      <span className="relative w-10 shrink-0 text-right text-sm font-semibold tabular-nums" style={{ color: done ? color : 'var(--ink-3)' }}>
        +{xp}
        {floating > 0 && (
          <span
            key={floating}
            aria-hidden
            onAnimationEnd={() => setFloating(0)}
            className="absolute inset-0 animate-float-up"
            style={{ color }}
          >
            +{xp}
          </span>
        )}
      </span>
    </div>
  )
}
