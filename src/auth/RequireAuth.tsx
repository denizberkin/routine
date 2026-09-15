import { Navigate, Outlet } from 'react-router-dom'
import { DataProvider } from '../data/DataProvider'
import { useAuth } from './AuthProvider'

/** Wraps the app routes: waits for the persisted session check, redirects guests to /login, then loads shared data. */
export default function RequireAuth() {
  const { ready, session } = useAuth()
  if (!ready) return null
  if (!session) return <Navigate to="/login" replace />
  return (
    <DataProvider>
      <Outlet />
    </DataProvider>
  )
}
