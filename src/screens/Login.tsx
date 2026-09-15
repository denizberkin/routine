import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function Login() {
  const { ready, session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const message = await signIn(email.trim(), password)
    if (message) {
      setError(/invalid/i.test(message) ? 'Wrong email or password.' : message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xs rounded-[20px] bg-surface p-6 pt-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="relative block h-7 w-9" aria-hidden>
            <span className="absolute left-0 top-0.5 size-6 rounded-full bg-u1" />
            <span className="absolute left-3 top-0.5 size-6 rounded-full bg-u2 opacity-90" />
          </span>
          <span className="text-lg font-bold tracking-tight">Routine</span>
        </div>

        <div className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl bg-surface-2 px-4 text-ink placeholder:text-ink-3"
          />
          <label className="sr-only" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl bg-surface-2 px-4 text-ink placeholder:text-ink-3"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-5 h-12 w-full rounded-xl bg-ink text-base font-semibold text-ground transition-opacity disabled:opacity-60"
        >
          Sign in
        </button>

        <p
          role="alert"
          aria-live="polite"
          className={`mt-3 min-h-5 text-center text-sm text-danger ${error ? '' : 'invisible'}`}
        >
          {error ?? '\u00a0'}
        </p>
      </form>
    </div>
  )
}
