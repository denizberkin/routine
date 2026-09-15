import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Calendar from './screens/Calendar'
import Login from './screens/Login'
import Plan from './screens/Plan'
import Today from './screens/Today'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/plan" element={<Plan />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
