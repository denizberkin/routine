import { useState } from 'react'

interface Props {
  title: string
  /** Small line under the title, e.g. "2/4 this week" */
  meta?: string
  xp: number
  done: boolean
  /** CSS color for the checkbox fill and XP — the acting user's slot color */
  color: string
  disabled?: boolean
  onToggle: () => void
}

/** One tappable task. Tap anywhere on the row; the whole thing is the target. */
export default function TaskRow({ title, meta, xp, done, color, disabled, onToggle }: Props) {
  const [floating, setFloating] = useState(0)

  function toggle() {
    if (!done) setFloating((n) => n + 1)
    onToggle()
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={disabled}
      onClick={toggle}
      className="flex w-full items-center gap-3.5 rounded-row px-2 py-3 text-left transition-colors active:bg-surface disabled:opacity-50"
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
      <span className="relative shrink-0 text-sm font-semibold tabular-nums" style={{ color: done ? color : 'var(--ink-3)' }}>
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
    </button>
  )
}
