import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Provider } from '@supabase/supabase-js'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function Login() {
  const { ready, session, signIn, signInWith } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // A refused OAuth login comes back as ?error=…&error_description=… on the redirect URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const description = params.get('error_description')
    if (description) {
      setError(description.replace(/\+/g, ' '))
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }, [])

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

  async function oauth(provider: Provider) {
    setBusy(true)
    setError(null)
    const message = await signInWith(provider)
    if (message) {
      setError(message)
      setBusy(false)
    }
  }

  const field = 'h-12 rounded-xl bg-surface-2 px-4 text-ink placeholder:text-ink-3'
  const providerButton =
    'flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-surface-2 text-sm font-semibold text-ink transition-opacity disabled:opacity-60'

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
            className={field}
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
            className={field}
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
          {error ?? ' '}
        </p>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={() => oauth('google')} className={providerButton}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <button type="button" disabled={busy} onClick={() => oauth('github')} className={providerButton}>
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
            Continue with GitHub
          </button>
        </div>
      </form>
    </div>
  )
}
