import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { subDays } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { awardFor } from '../lib/gamification'
import { supabase } from '../lib/supabase'
import { toYmd, today } from '../lib/schedule'
import type { Ymd } from '../lib/schedule'
import type { Completion, DayNote, Task } from '../lib/types'

interface DataState {
  loading: boolean
  /** Tasks from every active routine — shared by both users. */
  tasks: Task[]
  /** Every completion by either user. Two people → small enough to hold whole. */
  completions: Completion[]
  notes: DayNote[]
  /** One-line, auto-clearing; shown by the shell. */
  error: string | null
  /** Log a completion; XP is worked out here (streak multiplier, half for backfill). */
  complete: (task: Task, day: Ymd) => Promise<void>
  uncomplete: (task: Task, day: Ymd) => Promise<void>
  /** Leave today's "poke" note for the other person. */
  poke: () => Promise<void>
  refresh: () => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

const sameKey = (a: Pick<Completion, 'task_id' | 'user_id' | 'due_date'>, b: typeof a) =>
  a.task_id === b.task_id && a.user_id === b.user_id && a.due_date === b.due_date

function upsert(list: Completion[], row: Completion): Completion[] {
  const i = list.findIndex((c) => sameKey(c, row))
  if (i === -1) return [...list, row]
  const next = list.slice()
  next[i] = row
  return next
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [notes, setNotes] = useState<DayNote[]>([])
  const [error, setErrorState] = useState<string | null>(null)
  const errorTimer = useRef<number | undefined>(undefined)
  const latest = useRef(completions)
  latest.current = completions

  const setError = useCallback((message: string | null) => {
    setErrorState(message)
    window.clearTimeout(errorTimer.current)
    if (message) errorTimer.current = window.setTimeout(() => setErrorState(null), 3500)
  }, [])

  const refresh = useCallback(async () => {
    const [routines, comps, dayNotes] = await Promise.all([
      supabase.from('routines').select('id, created_at').eq('is_active', true).order('created_at'),
      supabase.from('completions').select('*'),
      supabase.from('day_notes').select('*').gte('day', toYmd(subDays(new Date(), 30))),
    ])
    const failed = routines.error ?? comps.error ?? dayNotes.error
    if (failed) {
      setError(failed.message)
      setLoading(false)
      return
    }
    const ids = (routines.data ?? []).map((r) => r.id as string)
    let taskRows: Task[] = []
    if (ids.length) {
      const { data, error } = await supabase.from('tasks').select('*').in('routine_id', ids).order('sort_order')
      if (error) setError(error.message)
      // keep routine order (oldest first), then the plan's own order
      const rank = new Map(ids.map((id, i) => [id, i]))
      taskRows = ((data ?? []) as Task[]).sort(
        (a, b) => rank.get(a.routine_id)! - rank.get(b.routine_id)! || a.sort_order - b.sort_order,
      )
    }
    setTasks(taskRows)
    setCompletions((comps.data ?? []) as Completion[])
    setNotes((dayNotes.data ?? []) as DayNote[])
    setLoading(false)
  }, [setError])

  // Initial load, then refetch whenever the tab comes back (phone unlocked, app foregrounded).
  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])

  // Live updates: the other person's completions and notes appear as they happen.
  useEffect(() => {
    const channel = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setCompletions((cs) => cs.filter((c) => c.id !== id))
        } else {
          setCompletions((cs) => upsert(cs, payload.new as Completion))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_notes' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setNotes((ns) => ns.filter((n) => n.id !== id))
        } else {
          const row = payload.new as DayNote
          setNotes((ns) => [...ns.filter((n) => n.id !== row.id), row])
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const complete = useCallback(
    async (task: Task, day: Ymd) => {
      if (!userId) return
      const xp = awardFor(task, day, latest.current, userId, today())
      const optimistic: Completion = {
        id: `pending-${task.id}-${day}`,
        task_id: task.id,
        user_id: userId,
        due_date: day,
        xp_awarded: xp,
        completed_at: new Date().toISOString(),
      }
      setCompletions((cs) => upsert(cs, optimistic))
      const { data, error } = await supabase
        .from('completions')
        .insert({ task_id: task.id, user_id: userId, due_date: day, xp_awarded: xp })
        .select()
        .single()
      if (error) {
        setCompletions((cs) => cs.filter((c) => c.id !== optimistic.id))
        setError('Not saved — check your connection.')
        return
      }
      setCompletions((cs) => upsert(cs, data as Completion))
    },
    [userId, setError],
  )

  const uncomplete = useCallback(
    async (task: Task, day: Ymd) => {
      if (!userId) return
      const key = { task_id: task.id, user_id: userId, due_date: day }
      let removed: Completion | undefined
      setCompletions((cs) => {
        removed = cs.find((c) => sameKey(c, key))
        return cs.filter((c) => !sameKey(c, key))
      })
      const { error } = await supabase.from('completions').delete().match(key)
      if (error) {
        if (removed) setCompletions((cs) => upsert(cs, removed!))
        setError('Not saved — check your connection.')
      }
    },
    [userId, setError],
  )

  const poke = useCallback(async () => {
    if (!userId) return
    const { error } = await supabase
      .from('day_notes')
      .upsert({ user_id: userId, day: today(), body: 'poke' }, { onConflict: 'user_id,day' })
    if (error) setError('Not sent — check your connection.')
    else refresh()
  }, [userId, setError, refresh])

  const value = useMemo<DataState>(
    () => ({ loading, tasks, completions, notes, error, complete, uncomplete, poke, refresh }),
    [loading, tasks, completions, notes, error, complete, uncomplete, poke, refresh],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
