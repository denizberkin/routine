import { useAuth } from '../auth/AuthProvider'

export default function Plan() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <p className="pt-24 text-center text-ink-2">Paste a plan to get started.</p>
      <button
        type="button"
        onClick={signOut}
        className="mt-auto self-center py-3 text-sm text-ink-3 hover:text-ink-2"
      >
        Sign out
      </button>
    </div>
  )
}
