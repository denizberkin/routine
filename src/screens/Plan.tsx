import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import AvatarMenu from '../components/AvatarMenu'
import { fillOf, inkOf } from '../lib/colors'
import { describeRecurrence, parseRoutine } from '../lib/parser'
import { formatMinutes } from '../lib/timer'
import type { ParsedRoutine, ParsedTask } from '../lib/parser'
import { useData } from '../data/DataProvider'
import { deleteRoutine, listRoutines, saveRoutine, setRoutineActive } from '../lib/routines'
import type { Routine } from '../lib/types'

type RoutineRow = Routine & { task_count: number }

/** Supabase errors are plain objects, not Error instances — read the message either way. */
const messageOf = (e: unknown, fallback: string) =>
  typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string' ? e.message : fallback

const day = (d: string) => format(parseISO(d), 'd MMM')

export default function Plan() {
  const { me, friend, slotOf } = useAuth()
  const { refresh: refreshData } = useData()
  const [md, setMd] = useState('')
  const [parsed, setParsed] = useState<ParsedRoutine | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [routines, setRoutines] = useState<RoutineRow[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const refresh = () => listRoutines().then(setRoutines).catch(() => {})
  useEffect(() => {
    refresh()
  }, [])

  const editing = useMemo(() => routines.find((r) => r.id === editingId) ?? null, [routines, editingId])
  const myColor = me ? inkOf(slotOf(me.id)) : 'var(--ink)'

  function parse() {
    setParsed(parseRoutine(md))
    setSaveState('idle')
    setSaveError(null)
  }

  async function save() {
    if (!parsed) return
    if (!me) {
      setSaveError('No profile for this account yet.')
      return
    }
    setSaveState('saving')
    setSaveError(null)
    try {
      const id = await saveRoutine(parsed, md, me.id, editingId)
      setEditingId(id)
      setSaveState('saved')
      refresh()
    } catch (e) {
      setSaveState('idle')
      setSaveError(messageOf(e, 'Could not save.'))
    }
  }

  function load(r: RoutineRow) {
    setMd(r.source_markdown)
    setParsed(null)
    setSaveState('idle')
    setEditingId(r.owner_id === me?.id ? r.id : null)
    textareaRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggle(r: RoutineRow) {
    setRoutines((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)))
    try {
      await setRoutineActive(r.id, !r.is_active)
    } catch {
      refresh()
    }
  }

  async function remove(r: RoutineRow) {
    setConfirmDelete(null)
    setRoutines((rs) => rs.filter((x) => x.id !== r.id))
    if (editingId === r.id) setEditingId(null)
    try {
      await deleteRoutine(r.id)
      refreshData()
    } catch (e) {
      setSaveError(messageOf(e, 'Could not delete.'))
      refresh()
    }
  }

  const canSave = parsed !== null && parsed.tasks.length > 0 && parsed.errors.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Plan</h1>
        <AvatarMenu />
      </header>
      {editing && (
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setParsed(null)
          }}
          className="-mt-3 self-start text-sm text-ink-2"
        >
          Editing {editing.title} <span className="ml-1 text-ink-3">×</span>
        </button>
      )}

      <textarea
        ref={textareaRef}
        value={md}
        onChange={(e) => {
          setMd(e.target.value)
          setParsed(null)
        }}
        placeholder="Paste your plan"
        spellCheck={false}
        className="min-h-[38dvh] w-full resize-y rounded-2xl bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-3"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={parse}
          disabled={!md.trim()}
          className="h-12 flex-1 rounded-xl bg-surface-2 font-semibold text-ink transition-opacity disabled:opacity-40"
        >
          Parse
        </button>
        {parsed && (
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saveState === 'saving'}
            className="h-12 flex-1 rounded-xl bg-ink font-semibold text-ground transition-opacity disabled:opacity-40"
          >
            {saveState === 'saved' ? 'Saved' : editingId ? 'Save changes' : 'Save routine'}
          </button>
        )}
      </div>
      {saveError && <p className="-mt-3 text-sm text-danger">{saveError}</p>}

      {parsed && parsed.errors.length > 0 && (
        <ul className="flex flex-col gap-2">
          {parsed.errors.map((e, i) => (
            <li key={i} className="rounded-xl border border-danger/30 px-3 py-2 text-sm">
              <span className="font-semibold text-danger">Line {e.line}</span>
              <span className="text-ink-2"> {e.message}</span>
              {e.text && (
                <div className="mt-1 truncate font-mono text-xs text-ink-3">{e.text}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {parsed && parsed.tasks.length > 0 && (
        <Preview parsed={parsed} color={myColor} />
      )}

      {routines.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="mb-1 text-sm font-semibold text-ink-2">Routines</h2>
          {routines.map((r) => {
            const mine = r.owner_id === me?.id
            const owner = mine ? me : friend
            if (confirmDelete === r.id) {
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className="text-xs text-danger">Deletes {r.task_count} tasks and their history</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="h-9 rounded-full bg-danger px-3 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="h-9 rounded-full bg-surface-2 px-3 text-xs font-semibold text-ink"
                  >
                    Keep
                  </button>
                </div>
              )
            }
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl py-2">
                <span className="text-xl" aria-hidden>
                  {owner?.avatar_emoji ?? '·'}
                </span>
                <button
                  type="button"
                  onClick={() => load(r)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className={`truncate font-semibold ${r.is_active ? 'text-ink' : 'text-ink-3'}`}>
                    {r.title}
                  </div>
                  <div className="text-xs text-ink-3">{r.task_count} tasks</div>
                </button>
                <Switch
                  on={r.is_active}
                  disabled={!mine}
                  color={fillOf(slotOf(r.owner_id))}
                  onChange={() => toggle(r)}
                  label={`${r.title} active`}
                />
                {mine && (
                  <button
                    type="button"
                    aria-label={`Delete ${r.title}`}
                    onClick={() => setConfirmDelete(r.id)}
                    className="grid size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-danger"
                  >
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

function Preview({ parsed, color }: { parsed: ParsedRoutine; color: string }) {
  const phases = useMemo(() => {
    const out: { phase: string | null; window: string; groups: Map<string, ParsedTask[]> }[] = []
    for (const t of parsed.tasks) {
      let p = out.at(-1)
      if (!p || p.phase !== t.phase) {
        p = {
          phase: t.phase,
          window: t.ends_on ? `${day(t.starts_on)} – ${day(t.ends_on)}` : `from ${day(t.starts_on)}`,
          groups: new Map(),
        }
        out.push(p)
      }
      p.groups.set(t.category, [...(p.groups.get(t.category) ?? []), t])
    }
    return out
  }, [parsed])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{parsed.title}</h2>
        <span className="text-sm text-ink-2">{parsed.tasks.length} tasks</span>
      </div>
      {phases.map((p, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
            <span className="font-semibold">{p.phase ?? 'No phase'}</span>
            <span className="shrink-0 text-xs text-ink-2">{p.window}</span>
          </div>
          {[...p.groups].map(([category, tasks]) => (
            <div key={category}>
              <div className="mb-1 text-xs font-semibold text-ink-2">{category}</div>
              <ul className="flex flex-col">
                {tasks.map((t) => (
                  <li key={t.line} className="flex items-baseline gap-3 py-1 text-sm">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {describeRecurrence(t.recurrence)}
                      {t.duration_min !== null && ` · ${formatMinutes(t.duration_min)}`}
                    </span>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
                      +{t.xp}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

function Switch({
  on,
  disabled,
  color,
  onChange,
  label,
}: {
  on: boolean
  disabled?: boolean
  color: string
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{ background: on ? color : 'var(--surface-2)' }}
    >
      <span
        className="absolute top-1 size-5 rounded-full bg-white shadow-sm transition-[left]"
        style={{ left: on ? 'calc(100% - 1.5rem)' : '0.25rem' }}
      />
    </button>
  )
}
