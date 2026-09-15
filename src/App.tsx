import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import Shell from './components/Shell'
import { isConfigured } from './lib/supabase'
import Calendar from './screens/Calendar'
import Login from './screens/Login'
import Plan from './screens/Plan'
import Today from './screens/Today'

export default function App() {
  if (!isConfigured) {
    return (
      <p className="pt-24 text-center text-ink-2">
        Missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
      </p>
    )
  }
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={<Today />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/plan" element={<Plan />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
