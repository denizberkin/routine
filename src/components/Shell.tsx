import { NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useTimer } from '../data/TimerProvider'
import { inkOf } from '../lib/colors'
import { formatClock } from '../lib/timer'
import Celebrations from './Celebrations'
import TimerSheet from './TimerSheet'

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    to: '/plan',
    label: 'Plan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6.5h14M5 12h14M5 17.5h8" />
      </svg>
    ),
  },
]

export default function Shell() {
  const { profileError, me, slotOf } = useAuth()
  const { error } = useData()
  const timer = useTimer()
  const notice = profileError ?? error
  const color = me ? inkOf(slotOf(me.id)) : 'var(--ink)'
  return (
    <div className="flex min-h-dvh flex-col">
      {notice && (
        <div role="alert" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">
            {notice}
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
        <Outlet />
      </main>
      <TimerSheet />
      <Celebrations />
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/90 backdrop-blur-md">
        {timer.active && !timer.open && (
          <button
            type="button"
            onClick={timer.show}
            className="mx-auto flex w-full max-w-md items-center gap-3 border-b border-line px-5 py-2 text-left"
          >
            <span className="text-sm font-bold tabular-nums" style={{ color }}>
              {timer.finished ? 'Time’s up' : formatClock(timer.remaining)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{timer.active.title}</span>
            {!timer.running && !timer.finished && <span className="text-xs text-ink-3">paused</span>}
          </button>
        )}
        <div className="mx-auto flex max-w-md pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
                }`
              }
            >
              <span className="size-6">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
