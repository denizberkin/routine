import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useToday } from '../data/useToday'
import { achievements } from '../lib/achievements'
import { fillOf, inkOf } from '../lib/colors'
import { xpSummary } from '../lib/gamification'

/** Bottom sheet: XP breakdown and the nine badges, locked ones greyed with their progress. */
export default function BadgesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, friend, slotOf } = useAuth()
  const { tasks, completions } = useData()
  const day = useToday()
  if (!open || !me) return null

  const color = fillOf(slotOf(me.id))
  const ink = inkOf(slotOf(me.id))
  const xp = xpSummary(tasks, completions, me.id, friend?.id ?? null, day)
  const badges = achievements(tasks, completions, me.id, friend?.id ?? null, day)

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-label="Achievements"
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-md overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-semibold">Achievements</h2>
          <span className="text-sm font-semibold tabular-nums" style={{ color: ink }}>
            {xp.total} XP
          </span>
        </div>
        <div className="mb-5 flex gap-4 text-xs tabular-nums text-ink-3">
          <span>{xp.base} from tasks</span>
          {xp.sameDayBonus > 0 && <span>🤝 {xp.sameDayBonus}</span>}
          {xp.partyBonus > 0 && <span>🎉 {xp.partyBonus}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {badges.map((b) => (
            <div
              key={b.id}
              className="flex flex-col items-center gap-1 rounded-2xl px-1 py-3 text-center"
              style={{ background: b.unlocked ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--surface-2)' }}
            >
              <span
                className="grid size-12 place-items-center rounded-full text-[26px] leading-none"
                style={
                  b.unlocked
                    ? { background: `color-mix(in srgb, ${color} 22%, transparent)` }
                    : { filter: 'grayscale(1)', opacity: 0.35 }
                }
                aria-hidden
              >
                {b.emoji}
              </span>
              <span className={`mt-1 text-xs font-semibold ${b.unlocked ? 'text-ink' : 'text-ink-3'}`}>{b.name}</span>
              <span className="text-[11px] leading-tight text-ink-3">{b.hint}</span>
              {!b.unlocked && b.progress && (
                <span className="text-[11px] font-semibold tabular-nums text-ink-2">
                  {b.progress.done}/{b.progress.need}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
