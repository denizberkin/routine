import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

const EMOJIS = [
  '🎯', '🔥', '⚡', '🌙', '⭐', '🌈', '🍀', '🚀', '💎', '🧠', '🎸', '🎲',
  '😀', '😎', '🤓', '🥳', '😤', '🤠', '🥸', '😈', '👻', '🤖', '👽', '💀',
  '🐢', '🐸', '🐙', '🦊', '🐼', '🐨', '🦁', '🐯', '🐺', '🦄', '🐝', '🦋',
  '🐧', '🦉', '🐳', '🦈', '🐉', '🐌', '🥷', '🧗', '🏃', '🚴', '🏋️', '🧘',
]

/** Your emoji in a tinted circle. Tap for the account menu: change the emoji, or sign out. */
export default function AvatarMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { me, slotOf, signOut, setAvatar } = useAuth()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const color = me ? `var(--${slotOf(me.id)})` : 'var(--ink-3)'

  function close() {
    setOpen(false)
    setPicking(false)
    setError(null)
  }

  async function pick(emoji: string) {
    const message = await setAvatar(emoji)
    if (message) setError(message)
    else close()
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex size-10 items-center justify-center rounded-full text-[22px] leading-none transition-transform active:scale-95"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        {me?.avatar_emoji ?? '·'}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={close} className="fixed inset-0 z-10 cursor-default" />
          <div
            role="menu"
            className={`absolute z-20 mt-2 rounded-xl bg-surface-2 p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] ${
              align === 'left' ? 'left-0' : 'right-0'
            } ${picking ? 'w-[19.5rem] max-w-[calc(100vw-2rem)]' : 'min-w-40'}`}
          >
            {picking ? (
              <div className="p-1">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJIS.map((e) => {
                    const current = e === me?.avatar_emoji
                    return (
                      <button
                        key={e}
                        type="button"
                        role="menuitemradio"
                        aria-checked={current}
                        onClick={() => pick(e)}
                        className="grid size-9 place-items-center rounded-lg text-xl leading-none transition-transform hover:bg-surface active:scale-90"
                        style={current ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                      >
                        {e}
                      </button>
                    )
                  })}
                </div>
                {error && <p className="px-1 pt-2 text-xs text-danger">{error}</p>}
              </div>
            ) : (
              <>
                <div className="px-3 pb-1 pt-2 text-xs text-ink-3">{me?.display_name}</div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setPicking(true)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
                >
                  Change emoji
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close()
                    signOut()
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
