# Routine — Build TODO

Source of truth: `routine-spec.md`. Order follows spec §9. **The app is genuinely usable after Phase 6** — everything after is motivation surface.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **(user)** = manual step only the user can do (dashboards, secrets)

State as of 2026-09-15: empty repo, no commits, remote `origin` = github.com/denizberkin/routine, branch `main`.

---

## 0. Decisions & defaults

Spec **[DECISION]** items — defaults adopted; ask the user before deviating:
- [ ] Calendar default view = month. Week toggle only if trivial, otherwise skip.
- [ ] Weekly party goal target = 80% of combined scheduled tasks.
- [ ] Poke = write a `day_notes` row owned by the poker (RLS only allows own writes); the other user sees it on next load / via realtime. No push.

Under-specified behaviors — defaults chosen so they aren't re-decided. Update here if changed:
- [ ] Week boundary (streak grace day, `@weekly:N` quota, party goal) = ISO week, Mon–Sun.
- [ ] "Scheduled tasks" for the party goal: `@daily` × 7, `@days` × matching days, `@weekly:N` → N, `!once` → excluded.
- [ ] Timezone: no per-user tz in schema → use the viewer's local time for "past midday", "before 07:00", and `due_date`.
- [ ] Multiplier is based on streak as of the completion's `due_date`; backfill halves after multiplier; round to int; stored in `xp_awarded`.
- [ ] Same-day bonus (+15) and party-goal bonus are **derived client-side**, not stored — XP is always `sum(xp_awarded) + derived bonuses`.
- [ ] Level-up celebration + badge-unlock toasts: "seen" state in `localStorage`, keyed by user id + level/badge.
- [ ] `!once` tasks appear in Today every day of their phase window until completed.
- [ ] `recharts` not installed — spec lists it "only if needed for the stats view" and there is no stats screen in v1.

---

## 1. Scaffold + deploy (blank app live at the URL)
- [ ] `npm create vite@latest` (react-ts) into this dir — keep existing `*.md`, `.gitignore`, `junk/`
- [ ] Deps: `react-router-dom`, `@supabase/supabase-js`, `date-fns`, `tailwindcss` + `@tailwindcss/vite`; dev: `vitest`
- [ ] `vite.config.ts` → `base: '/routine/'`
- [ ] Tailwind: dark default via `prefers-color-scheme` (`media`), system font stack, two fixed user colors as theme tokens
- [ ] `HashRouter` with placeholder routes `/login`, `/`, `/calendar`, `/plan`
- [ ] `.env.example` (URL + anon key); extend `.gitignore` with `node_modules/`, `dist/`, `.env.local`
- [ ] `.github/workflows/deploy.yml` — verbatim from spec §8
- [ ] `supabase/schema.sql` — tables, indexes, RLS from spec §3 (versioned even though it's run by hand)
- [ ] **(user)** GitHub → Settings → Pages → Source: **GitHub Actions**
- [ ] **(user)** GitHub → Settings → Secrets → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (placeholders OK until Phase 3)
- [ ] Initial commit, push `main` → confirm blank app renders at https://denizberkin.github.io/routine/ and that `#/calendar` etc. survive a refresh

## 2. Auth
- [ ] `src/lib/supabase.ts` — client from `import.meta.env.VITE_*`, fail loudly if missing
- [ ] `AuthProvider` — session state, `onAuthStateChange`, persisted session (default localStorage)
- [ ] `/login` — email + password, single centered card, inline error line, **no signup link**
- [ ] `RequireAuth` — unauthenticated → `/login`; authenticated visiting `/login` → `/`
- [ ] Small sign-out affordance in the header
- [ ] After login: load both `profiles` rows → `me` and `friend` in context

## 3. Schema + users (mostly user)
- [ ] **(user)** Create Supabase project (free tier); run `supabase/schema.sql` in the SQL editor
- [ ] **(user)** Auth → Providers → disable public signups; turn off email confirmation
- [ ] **(user)** Auth → Users → add both users (email + password)
- [ ] `supabase/seed-profiles.sql` — template `insert into profiles (id, display_name, avatar_emoji)` with placeholders → **(user)** fill ids and run
- [ ] **(user)** Database → Replication (or Realtime) → enable for `completions` and `day_notes`
- [ ] **(user)** Put real URL + anon key into `.env.local` and the GitHub secrets
- [ ] Verify: both users can log in locally; `select * from profiles` returns 2 rows; a user cannot insert a completion with someone else's `user_id`

## 4. Markdown parser + `/plan`
- [ ] `src/lib/parser.ts` — pure `parseRoutine(md) → { title, start, tasks, errors }` per spec §5
  - frontmatter `title`, `start`
  - `## Phase`, `> YYYY-MM-DD -> YYYY-MM-DD` window, `### Category`
  - `- [ ] Title @daily | @mon,wed,… | @weekly:N | !once  +N`
  - strip tokens from title; XP default 10; missing window → frontmatter `start`, open end
  - unknown token / task outside a category / bad date → error with line number, line skipped
  - recurrence stored as `'daily' | 'days:mon,wed' | 'weekly:N' | 'once'`
- [ ] `src/lib/parser.test.ts` — `routine-seed-plan.md` parses with **0 errors** and the right task count; bad-line cases; default XP; missing window fallback
- [ ] `src/lib/routines.ts` — save: upsert routine; diff tasks by `(title, category)` → keep `id` for matches, insert new, delete orphans; **never delete completions of matched tasks**
- [ ] `/plan` screen — textarea → **Parse** → preview table (title · category · phase · recurrence · XP · window) + per-line errors → **Save routine**
- [ ] Existing routines list with activate / deactivate
- [ ] Push the seed plan through end-to-end; confirm rows in `tasks`

## 5. `/` Today
- [ ] `src/lib/schedule.ts` — `isDueOn(task, date)` for daily / days / once / weekly; `weekQuota(task, completions, date)`; tests
- [ ] Data hook — active routines' tasks + all completions for both users (2 users → small, load all; refine later if needed)
- [ ] Today screen — header (level badge, XP bar, 🔥 streak — stub values until Phase 8), tasks grouped by category, large tappable rows with checkbox
- [ ] `@weekly:N` rows show "2/4 this week", checkable any day of the week
- [ ] `!once` rows shown until completed
- [ ] Complete / uncomplete = optimistic insert / delete on `completions`, rollback on error, no spinner
- [ ] XP total = `sum(xp_awarded)` (multipliers/bonuses come in Phase 8)
- [ ] Empty state = one line + button to `/plan`

## 6. Realtime
- [ ] Subscribe to `postgres_changes` on `completions` + `day_notes`; merge into local state
- [ ] Friend card on Today — "Friend: 2/4 done 🔥 6", updates live
- [ ] Refetch on window focus / reconnect as a safety net
- [ ] ✅ **Milestone: usable app.** Deploy, both users start using it.

## 7. `/calendar`
- [ ] Month grid (date-fns), prev / next
- [ ] Per-day: two dots (user colors) tinted by completion ratio — empty / partial / full
- [ ] Day panel — both users' tasks for that day; own tasks checkable
- [ ] Backfill rule — only within the last 3 days, 50% XP, reduced XP shown explicitly; older days read-only
- [ ] Week toggle only if it falls out for free

## 8. Gamification core
- [ ] `src/lib/gamification.ts` — pure functions over completions:
  - `levelFor(xp)` — XP needed for level N = `50·N·(N+1)`; progress to next
  - `streak(days)` — ≥1 completion counts; one grace day per week; two misses in a week resets
  - `multiplier(streak)` — ≥7 → 1.25×, ≥30 → 1.5× (applied at completion time → `xp_awarded`)
  - `sameDayBonuses(comps)` — +15 each per day both have ≥1 completion
  - `partyGoal(tasks, comps, week)` — combined done vs 80% of combined scheduled; bonus when hit
- [ ] `src/lib/gamification.test.ts` — streak edge cases (grace consumed, two misses, week rollover), level thresholds, multiplier boundaries
- [ ] Wire real level / XP bar / streak into Today header and friend card
- [ ] "Both in today 🤝 +15" line when triggered
- [ ] Party-goal progress bar on Today
- [ ] Poke button — visible when friend has 0 completions today and local time ≥ 12:00; writes `day_notes`; recipient sees a one-line banner

## 9. Achievements
- [ ] `src/lib/achievements.ts` — the 9 badges from spec §6, pure function `(tasks, completions) → Badge[]`
- [ ] Badge grid (locked = greyed), reachable from the header
- [ ] One-line toast on new unlock; seen-state in `localStorage`

## 10. Polish
- [ ] Completion animation — checkbox fills, row dims, XP number floats up and fades, ~200ms
- [ ] Level-up full-screen celebration — confetti or similar, one-tap dismiss, once per level
- [ ] Two user colors consistent everywhere (avatars, dots, bars)
- [ ] Light-mode pass
- [ ] Mobile pass — Today fits one screen for 4–6 tasks; tap targets ≥ 44px
- [ ] Sweep for explanatory text / tooltips-as-docs and delete them

---

## Not in v1 (spec §10)
Push notifications · mobile apps · >2 users · task editing UI · image uploads · social feed · public profiles · data export.
