import { NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

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
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/90 backdrop-blur-md">
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
