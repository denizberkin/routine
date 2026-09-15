import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

/** Your emoji in a tinted circle. Tapping it opens the only account menu the app has: sign out. */
export default function AvatarMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { me, slotOf, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const color = me ? `var(--${slotOf(me.id)})` : 'var(--ink-3)'

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-full text-[22px] leading-none transition-transform active:scale-95"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        {me?.avatar_emoji ?? '·'}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className={`absolute z-20 mt-2 min-w-40 rounded-xl bg-surface-2 p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            <div className="px-3 pb-1 pt-2 text-xs text-ink-3">{me?.display_name}</div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
