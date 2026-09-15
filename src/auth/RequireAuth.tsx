import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/** Wraps the app routes: waits for the persisted session check, then redirects guests to /login. */
export default function RequireAuth() {
  const { ready, session } = useAuth()
  if (!ready) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
