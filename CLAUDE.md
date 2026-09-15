# Routine — CLAUDE.md

Two-person gamified accountability / routine tracker. Static React SPA on GitHub Pages, Supabase (Auth + Postgres + Realtime) as the backend. Exactly two users, no signup.

## Read first, in this order
1. `routine-spec.md` — full spec, source of truth. Ask the user before deviating from anything marked **[DECISION]**.
2. `TODO.md` — build checklist in spec §9 order. Resume at the first unchecked item; tick items off as they land. §0 records every default chosen for under-specified behavior — read it before touching gamification or scheduling logic, and add to it rather than re-deciding.
3. `routine-seed-plan.md` — the real plan the user will paste into `/plan`. The parser must accept it with zero errors; use it as the primary test fixture.

## Non-negotiables (from the spec)
- `vite.config.ts` has `base: '/routine/'`. Router is **HashRouter** — never BrowserRouter.
- Real Supabase Auth + RLS. The anon key in the bundle is correct and expected. **Never** put the `service_role` key anywhere client-side.
- XP, level, streak, multipliers, bonuses are **derived client-side from `completions`**. No denormalized counters in the DB.
- Markdown is the only way to edit tasks. No task-editing UI. Grammar = spec §5 plus one addition: `~N` (timer minutes, e.g. `~15`).
- Re-saving a routine must keep `task.id` for tasks whose `(title, category)` is unchanged so their completions survive.
- Streak: ≥1 completion counts for the day; one grace day per week. This is the most important design detail — don't make it stricter.
- Backfill: only the last 3 days, 50% XP, reduction shown explicitly.
- UI: dark default + `prefers-color-scheme` light, system font stack (no webfonts), mobile-first, no explanatory paragraphs / onboarding / tooltips-as-docs. Empty state = one line + one button.

## Stack
React 18 + TypeScript · Vite · Tailwind · `react-router-dom` (HashRouter) · `@supabase/supabase-js` · `date-fns` · vitest for `src/lib`. Custom markdown parser (~150 lines, grammar in spec §5) — no markdown library. `recharts` only if a stats view is ever added (not in v1).

## Target layout
```
src/
  lib/          supabase.ts, parser.ts, schedule.ts, routines.ts, gamification.ts, timer.ts, achievements.ts  ← pure logic, unit-tested
  data/         DataProvider (tasks + completions + realtime), TimerProvider (per-task countdown, persisted), useToday
  auth/         AuthProvider.tsx, RequireAuth.tsx
  screens/      Login.tsx, Today.tsx, Calendar.tsx, Plan.tsx
  components/   shared UI
supabase/       schema.sql (tables + RLS + grants + realtime), seed-profiles.sql (by email), migrations/ (run in order on an existing project)
.github/workflows/deploy.yml
```
Keep UI thin; anything with a rule in it lives in `src/lib` with a test.

## Commands
```
npm install
npm run dev        # local, needs .env.local
npm run build      # must pass before any push to main
npm run test       # vitest
npm run preview
```
Env: `.env.local` (gitignored) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `.env.example` documents them.

## Deploy
Push to `main` → GitHub Actions (`deploy.yml` from spec §8) → https://denizberkin.github.io/routine/ . Remote `origin` = github.com/denizberkin/routine, already configured. Repo is public on purpose. Supabase dashboard steps (schema, users, secrets) are the user's — they're marked **(user)** in `TODO.md`. Schema changes go in `supabase/migrations/` *and* `schema.sql`; tell the user the one line to run.

## Environment
Windows 11. PowerShell 5.1 is the primary shell (no `&&`; use `;`). Git Bash also available. Node 24, npm 11, git 2.46, gh 2.67. `junk/` is gitignored scratch — leave it alone.

## Working conventions
- Commits are authored by the user only — **no `Co-Authored-By` / `Claude-Session` trailers**. One line, lowercase prefix, main thing first: `add: login page`, `fix: streak week rollover`, `remove: unused dep`. One commit per TODO phase or smaller.
- Don't reformat or rewrite `routine-spec.md` / `routine-seed-plan.md`.
- When a spec detail is ambiguous, pick the simplest generous-to-the-user option, write it into `TODO.md` §0, and mention it in the reply.
