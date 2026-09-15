import { useState } from 'react'

interface Props {
  title: string
  /** Small line under the title: duration, "2/4 this week", a live countdown… */
  meta?: string
  /** Render the meta in the user's color (a running timer) */
  metaActive?: boolean
  xp: number
  done: boolean
  /** CSS color for the checkbox fill — the acting user's slot color */
  color: string
  /** Text variant of the same color; defaults to `color` */
  ink?: string
  /** Display only (the other person's row, or a day you can't change) */
  readOnly?: boolean
  onToggle?: () => void
  /** Tapping the title opens the task's own sheet (timer, mark done). Omit to make the title inert. */
  onOpen?: () => void
}

/** One task. The circle completes it in one tap; the title opens its sheet. */
export default function TaskRow({ title, meta, metaActive, xp, done, color, ink = color, readOnly, onToggle, onOpen }: Props) {
  const [floating, setFloating] = useState(0)

  function toggle() {
    if (!done) setFloating((n) => n + 1)
    onToggle?.()
  }

  const Body: 'div' | 'button' = onOpen && !readOnly ? 'button' : 'div'

  return (
    <div className="flex items-center">
      {readOnly ? (
        <span className="grid size-11 shrink-0 place-items-center" aria-hidden>
          <Check done={done} color={color} />
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Undo ${title}` : `Complete ${title}`}
          onClick={toggle}
          className="grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90"
        >
          <Check done={done} color={color} />
        </button>
      )}

      <Body
        {...(Body === 'button' ? { type: 'button' as const, onClick: onOpen } : {})}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-row py-3 pl-1 pr-2 text-left ${
          Body === 'button' ? 'transition-colors active:bg-surface' : ''
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className={`block line-clamp-2 text-[17px] font-medium leading-6 transition-colors duration-200 ${done ? 'text-ink-3' : 'text-ink'}`}>
            {title}
          </span>
          {meta && (
            <span className="block text-xs tabular-nums" style={{ color: metaActive ? ink : 'var(--ink-3)' }}>
              {meta}
            </span>
          )}
        </span>
        <span className="relative w-10 shrink-0 text-right text-sm font-semibold tabular-nums" style={{ color: done ? ink : 'var(--ink-3)' }}>
          +{xp}
          {floating > 0 && (
            <span
              key={floating}
              aria-hidden
              onAnimationEnd={() => setFloating(0)}
              className="absolute inset-0 animate-float-up"
              style={{ color: ink }}
            >
              +{xp}
            </span>
          )}
        </span>
      </Body>
    </div>
  )
}

function Check({ done, color }: { done: boolean; color: string }) {
  return (
    <span
      className="flex size-7 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-200"
      style={{ borderColor: done ? color : 'var(--line)', background: done ? color : 'transparent' }}
    >
      {done && (
        <svg viewBox="0 0 16 16" className="size-4 animate-pop" fill="none" stroke="var(--ground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      )}
    </span>
  )
}
