import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { today } from '../lib/schedule'
import type { Task } from '../lib/types'
import { useData } from './DataProvider'

interface ActiveTimer {
  taskId: string
  title: string
  xp: number
  durationMs: number
  /** Epoch ms when it hits zero; null while paused */
  endsAt: number | null
  /** Remaining ms captured at pause time */
  pausedMs: number
}

interface TimerState {
  active: ActiveTimer | null
  /** Sheet visibility — the timer keeps running when hidden */
  open: boolean
  remaining: number
  running: boolean
  finished: boolean
  start: (task: Task, minutes: number) => void
  pause: () => void
  resume: () => void
  addMinutes: (n: number) => void
  /** Stop and forget the timer */
  dismiss: () => void
  /** Complete the task (today) and dismiss */
  markDone: () => void
  show: () => void
  hide: () => void
}

const KEY = 'routine.timer'
const TimerContext = createContext<TimerState | null>(null)

function load(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ActiveTimer) : null
  } catch {
    return null
  }
}

function save(t: ActiveTimer | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode etc. — timer just won't survive a reload */
  }
}

const remainingOf = (t: ActiveTimer | null, now = Date.now()) =>
  !t ? 0 : t.endsAt === null ? t.pausedMs : t.endsAt - now

/** Three short tones. Needs an AudioContext unlocked by an earlier tap, which start() provides. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return
  const play = () => {
    const t0 = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.25 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.25 + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + i * 0.25)
      osc.stop(t0 + i * 0.25 + 0.2)
    }
  }
  if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
  else play()
}

async function notify(title: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const options: NotificationOptions = { body: title, tag: 'routine-timer' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification('Time’s up', options)
    else new Notification('Time’s up', options)
  } catch {
    /* platform without page notifications — sound + vibration still fire */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { tasks, complete } = useData()
  const [active, setActiveState] = useState<ActiveTimer | null>(load)
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState(() => remainingOf(active))
  const [finished, setFinished] = useState(() => active !== null && remainingOf(active) <= 0)
  const audio = useRef<AudioContext | null>(null)
  const originalTitle = useRef(document.title)

  const setActive = useCallback((t: ActiveTimer | null) => {
    setActiveState(t)
    save(t)
  }, [])

  // Tick while running; detect the end.
  useEffect(() => {
    if (!active) return
    const tick = () => {
      const left = remainingOf(active)
      setRemaining(left)
      if (active.endsAt !== null && left <= 0) setFinished(true)
    }
    tick()
    const id = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active])

  // Fire the alarm exactly once per timer.
  const alarmed = useRef<string | null>(null)
  useEffect(() => {
    if (!finished || !active) return
    const key = `${active.taskId}:${active.endsAt}`
    if (alarmed.current === key) return
    alarmed.current = key
    setOpen(true)
    notify(active.title)
    beep(audio.current)
    navigator.vibrate?.([200, 100, 200, 100, 400])
    document.title = '⏰ Time’s up'
  }, [finished, active])

  useEffect(() => {
    if (!finished) document.title = originalTitle.current
  }, [finished])

  const start = useCallback(
    (task: Task, minutes: number) => {
      const durationMs = minutes * 60_000
      if (!audio.current) {
        try {
          audio.current = new AudioContext()
        } catch {
          /* no audio */
        }
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      alarmed.current = null
      setFinished(false)
      setActive({ taskId: task.id, title: task.title, xp: task.xp, durationMs, endsAt: Date.now() + durationMs, pausedMs: 0 })
      setOpen(true)
    },
    [setActive],
  )

  const pause = useCallback(() => {
    if (!active || active.endsAt === null) return
    setActive({ ...active, pausedMs: Math.max(0, active.endsAt - Date.now()), endsAt: null })
  }, [active, setActive])

  const resume = useCallback(() => {
    if (!active || active.endsAt !== null) return
    setActive({ ...active, endsAt: Date.now() + active.pausedMs, pausedMs: 0 })
  }, [active, setActive])

  const addMinutes = useCallback(
    (n: number) => {
      if (!active) return
      const extra = n * 60_000
      setFinished(false)
      alarmed.current = null
      setActive(
        active.endsAt === null
          ? { ...active, pausedMs: active.pausedMs + extra, durationMs: active.durationMs + extra }
          : { ...active, endsAt: Math.max(Date.now(), active.endsAt) + extra, durationMs: active.durationMs + extra },
      )
    },
    [active, setActive],
  )

  const dismiss = useCallback(() => {
    setActive(null)
    setFinished(false)
    setOpen(false)
  }, [setActive])

  const markDone = useCallback(() => {
    if (active) {
      const task = tasks.find((t) => t.id === active.taskId)
      if (task) complete(task, today(), task.xp)
    }
    dismiss()
  }, [active, tasks, complete, dismiss])

  const value = useMemo<TimerState>(
    () => ({
      active,
      open,
      remaining,
      running: active !== null && active.endsAt !== null && !finished,
      finished,
      start,
      pause,
      resume,
      addMinutes,
      dismiss,
      markDone,
      show: () => setOpen(true),
      hide: () => setOpen(false),
    }),
    [active, open, remaining, finished, start, pause, resume, addMinutes, dismiss, markDone],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer(): TimerState {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used inside TimerProvider')
  return ctx
}
