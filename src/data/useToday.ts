import { useEffect, useState } from 'react'
import { today } from '../lib/schedule'

/** Today's date as YYYY-MM-DD, refreshed when the tab wakes up and once a minute (for midnight). */
export function useToday() {
  const [day, setDay] = useState(today)
  useEffect(() => {
    const check = () => {
      const now = today()
      if (now !== day) setDay(now)
    }
    const id = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [day])
  return day
}
