# Routine — Build TODO

Source of truth: `routine-spec.md`. Order follows spec §9. **The app is genuinely usable after Phase 6** — everything after is motivation surface.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **(user)** = manual step only the user can do (dashboards, secrets)

State as of 2026-09-15: Phases 1–6 + timers built and deployed. Supabase live; grants applied; user was still seeding `profiles` (email-based `seed-profiles.sql`) and needs to run the duration migration. Next: Phase 7 calendar, then Phase 8 multipliers / bonuses / party goal / poke.

---

## 0. Decisions & defaults

Spec **[DECISION]** items — defaults adopted; ask the user before deviating:
- [x] Calendar default view = month. Week toggle only if trivial, otherwise skip.
- [x] Weekly party goal target = 80% of combined scheduled tasks.
- [x] Poke = write a `day_notes` row owned by the poker (RLS only allows own writes); the other user sees it on next load / via realtime. No push.

Under-specified behaviors — defaults chosen so they aren't re-decided. Update here if changed:
- [x] Week boundary (streak grace day, `@weekly:N` quota, party goal) = ISO week, Mon–Sun.
- [x] "Scheduled tasks" for the party goal: `@daily` × 7, `@days` × matching days, `@weekly:N` → N, `!once` → excluded.
- [x] Timezone: no per-user tz in schema → use the viewer's local time for "past midday", "before 07:00", and `due_date`.
- [x] Multiplier is based on streak as of the completion's `due_date`; backfill halves after multiplier; round to int; stored in `xp_awarded`.
- [x] Same-day bonus (+15) and party-goal bonus are **derived client-side**, not stored — XP is always `sum(xp_awarded) + derived bonuses`.
- [x] Streak: a grace day keeps the run alive but doesn’t add to the count; today never counts against you until it’s over. Level thresholds are per-step (L1→L2 100, L2→L3 300 …), i.e. cumulative 100 / 400 / 1000.
- [x] Sign out lives in the avatar menu (tap your emoji) in every screen’s header, not on Plan.
- [x] Plans are split into `plans/exercise.md` and `plans/rl.md` (one routine each); `routine-seed-plan.md` stays as the parser fixture.
- [x] Timers (user request, not in spec): every task row has a `⏱` chip; length = `~N` token → number in title ("15-20 min" → 15, "Five-minute" → 5) → 25 default. Countdown persists in `localStorage`; end = notification (via `public/sw.js`, needed on Android) + beep + vibration + tab title; "Mark done" completes the task for today. `tasks.duration_min` added (`supabase/migrations/2026-09-15-task-duration.sql`).
- [x] Level-up celebration + badge-unlock toasts: "seen" state in `localStorage`, keyed by user id + level/badge.
- [x] `!once` tasks appear in Today every day of their phase window until completed.
- [x] `recharts` not installed — spec lists it "only if needed for the stats view" and there is no stats screen in v1.
- [x] User color slot: profiles ordered by `created_at` — first is `u1` (marigold), second is `u2` (lilac). Same for both viewers.
- [x] Toolchain: Vite 8 / React 19 / TS 6 (template defaults; spec says React 18, nothing depends on it). Workflow runs Node 22, not 20 — Vitest 5 needs ≥22.
- [x] `schema.sql` also adds `completions` + `day_notes` to the `supabase_realtime` publication, so no separate dashboard step for realtime.

---

## 1. Scaffold + deploy (blank app live at the URL)
- [x] `npm create vite@latest` (react-ts) into this dir — keep existing `*.md`, `.gitignore`, `junk/`
- [x] Deps: `react-router-dom`, `@supabase/supabase-js`, `date-fns`, `tailwindcss` + `@tailwindcss/vite`; dev: `vitest`
- [x] `vite.config.ts` → `base: '/routine/'`
- [x] Tailwind: dark default via `prefers-color-scheme` (`media`), system font stack, two fixed user colors as theme tokens
- [x] `HashRouter` with placeholder routes `/login`, `/`, `/calendar`, `/plan`
- [x] `.env.example` (URL + anon key); extend `.gitignore` with `node_modules/`, `dist/`, `.env.local`
- [x] `.github/workflows/deploy.yml` — verbatim from spec §8
- [x] `supabase/schema.sql` — tables, indexes, RLS from spec §3 (versioned even though it's run by hand)
- [x] **(user)** GitHub → Settings → Pages → Source: **GitHub Actions**
- [x] **(user)** GitHub → Settings → Secrets → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (placeholders OK until Phase 3)
- [x] Initial commit, push `main` → confirm blank app renders at https://denizberkin.github.io/routine/ and that `#/calendar` etc. survive a refresh

## 2. Auth
- [x] `src/lib/supabase.ts` — client from `import.meta.env.VITE_*`, fail loudly if missing
- [x] `AuthProvider` — session state, `onAuthStateChange`, persisted session (default localStorage)
- [x] `/login` — email + password, single centered card, inline error line, **no signup link**
- [x] `RequireAuth` — unauthenticated → `/login`; authenticated visiting `/login` → `/`
- [x] Small sign-out affordance in the header
- [x] After login: load both `profiles` rows → `me` and `friend` in context

## 3. Schema + users (mostly user)
- [x] **(user)** Create Supabase project (free tier); run `supabase/schema.sql` in the SQL editor
- [x] **(user)** Auth → Providers → disable public signups; turn off email confirmation
- [x] **(user)** Auth → Users → add both users (email + password)
- [x] `supabase/seed-profiles.sql` — template `insert into profiles (id, display_name, avatar_emoji)` with placeholders → **(user)** fill ids and run
- [x] **(user)** Put real URL + anon key into `.env.local` and the GitHub secrets
- [ ] Verify: both users can log in locally; `select * from profiles` returns 2 rows; a user cannot insert a completion with someone else's `user_id`

## 4. Markdown parser + `/plan`
- [x] `src/lib/parser.ts` — pure `parseRoutine(md) → { title, start, tasks, errors }` per spec §5
  - frontmatter `title`, `start`
  - `## Phase`, `> YYYY-MM-DD -> YYYY-MM-DD` window, `### Category`
  - `- [ ] Title @daily | @mon,wed,… | @weekly:N | !once  +N`
  - strip tokens from title; XP default 10; missing window → frontmatter `start`, open end
  - unknown token / task outside a category / bad date → error with line number, line skipped
  - recurrence stored as `'daily' | 'days:mon,wed' | 'weekly:N' | 'once'`
- [x] `src/lib/parser.test.ts` — `routine-seed-plan.md` parses with **0 errors** and the right task count; bad-line cases; default XP; missing window fallback
- [x] `src/lib/routines.ts` — save: upsert routine; diff tasks by `(title, category)` → keep `id` for matches, insert new, delete orphans; **never delete completions of matched tasks**
- [x] `/plan` screen — textarea → **Parse** → preview table (title · category · phase · recurrence · XP · window) + per-line errors → **Save routine**
- [x] Existing routines list with activate / deactivate
- [ ] Push the seed plan through end-to-end; confirm rows in `tasks`

## 5. `/` Today
- [x] `src/lib/schedule.ts` — `isDueOn`, `weekOf` (ISO), `doneThisWeek`, `scheduledInWeek`, `dayStatus`, `canBackfill`; tests
- [x] Data hook — active routines' tasks + all completions for both users (2 users → small, load all; refine later if needed)
- [x] Today screen — header (level badge, XP bar, 🔥 streak — stub values until Phase 8), tasks grouped by category, large tappable rows with checkbox
- [x] `@weekly:N` rows show "2/4 this week", checkable any day of the week
- [x] `!once` rows shown until completed
- [x] Complete / uncomplete = optimistic insert / delete on `completions`, rollback on error, no spinner
- [x] XP total = `sum(xp_awarded)` (multipliers/bonuses come in Phase 8)
- [x] Empty state = one line + button to `/plan`

## 6. Realtime
- [x] Subscribe to `postgres_changes` on `completions` + `day_notes`; merge into local state
- [x] Friend card on Today — "Friend: 2/4 done 🔥 6", updates live
- [x] Refetch on window focus / reconnect as a safety net
- [ ] ✅ **Milestone: usable app.** Deploy, both users start using it.

## 7. `/calendar`
- [ ] Month grid (date-fns), prev / next
- [ ] Per-day: two dots (user colors) tinted by completion ratio — empty / partial / full
- [ ] Day panel — both users' tasks for that day; own tasks checkable
- [ ] Backfill rule — only within the last 3 days, 50% XP, reduced XP shown explicitly; older days read-only
- [ ] Week toggle only if it falls out for free

## 8. Gamification core
- [ ] `src/lib/gamification.ts` — pure functions over completions:
  - [x] `levelFor(xp)` — XP needed for level N = `50·N·(N+1)`; progress to next
  - [x] `streak(days)` — ≥1 completion counts; one grace day per week; two misses in a week resets
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
