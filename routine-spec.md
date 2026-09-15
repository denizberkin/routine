# Routine — Build Specification

**For the implementing agent:** this is a complete spec for a two-person gamified accountability app. Build it as described; ask the user before deviating on anything marked **[DECISION]**.

- **Repo name:** `routine` (owner: `denizberkin`)
- **Deployed URL:** `https://denizberkin.github.io/routine/`
- **Users:** exactly 2, both known in advance, no public signup

---

## 1. Constraints that drive the architecture

GitHub Pages is **static hosting only** — no server, no server-side secrets, no API routes. But the app needs real auth and live shared state. Therefore:

- **Frontend:** static SPA, built by GitHub Actions, deployed to GitHub Pages
- **Backend:** Supabase free tier (Postgres + Auth + Realtime). No custom server to write or pay for.

**Critical security note:** a password checked in client-side JavaScript is not authentication — anyone can read the bundle. Auth must be real Supabase Auth with Row Level Security. The Supabase **anon key is designed to be public** and shipping it in the bundle is correct and expected; RLS is what protects the data. Never put the `service_role` key anywhere in the frontend.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | |
| Build | Vite | `base: '/routine/'` in `vite.config.ts` — **required** for the subpath deploy |
| Routing | `react-router-dom` with **HashRouter** | Avoids GitHub Pages 404-on-refresh entirely. Do not use BrowserRouter. |
| Styling | Tailwind CSS | |
| Backend | Supabase (`@supabase/supabase-js`) | Auth, Postgres, Realtime |
| Markdown parsing | Custom parser (spec in §5) | Do not pull in a heavy MD lib; the format is constrained |
| Dates | `date-fns` | |
| Charts | `recharts` | Only if needed for the stats view |

---

## 3. Data model

Run this in the Supabase SQL editor.

```sql
-- Profiles: one row per user, created manually for the two of us
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_emoji text not null default '🎯',
  created_at timestamptz not null default now()
);

-- A parsed plan. Either user can create one; both can see both.
create table routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  source_markdown text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tasks parsed out of a routine's markdown
create table tasks (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines on delete cascade,
  title text not null,
  category text not null,              -- e.g. 'Exercise', 'RL'
  phase text,                          -- e.g. 'Phase 1: Just show up'
  xp int not null default 10,
  recurrence text not null,            -- 'daily' | 'days:mon,wed,fri' | 'weekly:2' | 'once'
  starts_on date not null,
  ends_on date,                        -- null = open-ended
  sort_order int not null default 0
);

-- One row per (task, user, date) completion
create table completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  due_date date not null,
  xp_awarded int not null default 0,
  completed_at timestamptz not null default now(),
  unique (task_id, user_id, due_date)
);

-- Optional short note attached to a day, for encouragement/trash talk
create table day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create index on completions (user_id, due_date);
create index on tasks (routine_id);
```

### RLS policies

Both users see everything (that's the entire point — shared visibility), but can only write their own rows.

```sql
alter table profiles enable row level security;
alter table routines enable row level security;
alter table tasks enable row level security;
alter table completions enable row level security;
alter table day_notes enable row level security;

-- Any authenticated user can read everything
create policy "read all" on profiles    for select to authenticated using (true);
create policy "read all" on routines    for select to authenticated using (true);
create policy "read all" on tasks       for select to authenticated using (true);
create policy "read all" on completions for select to authenticated using (true);
create policy "read all" on day_notes   for select to authenticated using (true);

-- Writes are self-only
create policy "own profile"   on profiles    for update to authenticated using (auth.uid() = id);
create policy "own routines"  on routines    for all    to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own tasks"     on tasks       for all    to authenticated
  using (exists (select 1 from routines r where r.id = routine_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from routines r where r.id = routine_id and r.owner_id = auth.uid()));
create policy "own comps"     on completions for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notes"     on day_notes   for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Auth setup (manual, one time)

1. Supabase Dashboard → Authentication → Providers → **disable public signups**
2. Authentication → Users → **Add user** twice (email + password), one per person
3. Insert a matching `profiles` row for each user id
4. Email confirmation can be turned off since accounts are created by hand

---

## 4. Screens

Keep it to four. The UI should be sparse — big tap targets, minimal copy, no paragraphs of explanation anywhere.

### `/login`
Email + password, single card, centered. Nothing else. No signup link (there is no signup).

### `/` — Today (default landing)
The screen that gets opened every morning. It must answer "what do I do right now" in under a second.

- Header: your level badge, XP bar to next level, current streak (🔥 N)
- **Today's tasks**, grouped by category, each a large tappable row with a checkbox
- Tapping = instant completion, optimistic UI, XP animates up
- Side-by-side or stacked: **the other person's same-day progress**, live. Small, glanceable — "Friend: 2/4 done 🔥 6"
- Live updates via Supabase Realtime subscription on `completions`

### `/calendar`
- Month grid, both users visible per day
- Each day cell shows two small dots/bars — one per user — colored by completion ratio (empty / partial / full)
- Clicking a day opens a panel: that day's tasks for both users, with the ability to check off **past days** (backfill allowed — see §6 for the anti-cheat-lite rule)
- **[DECISION]** Default view: month. Offer a week toggle if trivial.

### `/plan`
- Big textarea: paste markdown → **Parse** → preview of extracted tasks → **Save routine**
- Preview shows a table of what was parsed (title, category, recurrence, XP, window) so mistakes are caught before saving
- List of existing routines with activate/deactivate
- Parse errors displayed inline per line, never as a silent failure

---

## 5. Markdown input format

Constrained on purpose so the parser stays ~150 lines and errors are obvious.

````markdown
---
title: RL + Exercise Plan
start: 2026-09-16
---

## Phase 1: Just show up
> 2026-09-16 -> 2026-09-29

### Exercise
- [ ] Easy walk 15-20 min @mon,wed,fri,sat +10
- [ ] Mobility routine @tue,thu +8
- [ ] Five-minute minimum @daily +3

### RL
- [ ] Sutton & Barto Ch. 1-3 !once +50
- [ ] Implement value iteration on FrozenLake !once +60

## Phase 2: Add load
> 2026-09-30 -> 2026-10-13

### Exercise
- [ ] Walk 25-30 min @weekly:4 +12
````

**Grammar**

| Element | Meaning |
|---|---|
| YAML frontmatter | `title` (routine title), `start` (fallback start date) |
| `## Heading` | Phase name |
| `> DATE -> DATE` | Phase window; applies to all tasks under it |
| `### Heading` | Category (`Exercise`, `RL`, anything) |
| `- [ ] Text` | A task |
| `@daily` | Every day in the phase window |
| `@mon,wed,fri` | Specific weekdays (`mon tue wed thu fri sat sun`) |
| `@weekly:N` | N times per week, **any** days — flexible quota |
| `!once` | Single one-off task for the phase window |
| `+N` | XP value (default 10 if omitted) |

**Parser rules**
- Strip the `@`/`!`/`+` tokens from the stored `title`
- Missing `> DATE -> DATE` → fall back to frontmatter `start`, open-ended end
- Unknown token → parse error on that line, surfaced in the preview, that line skipped
- Re-saving a routine replaces its tasks but **must not delete existing completions** for tasks whose title+category are unchanged (match on those, preserve `task.id`)

**Flexible tasks (`@weekly:N`)** are the important case for the user's actual schedule — nothing has a fixed time. Render these in Today as "2/4 this week" rather than as a daily obligation, and let them be checked off on any day of the week.

---

## 6. Gamification

This is the part the user cares most about. Make it feel good, not bureaucratic.

### XP and levels
- XP comes from task completion (`task.xp`)
- Level thresholds grow quadratically: **XP needed for level N = `50 * N * (N + 1)`**
  (L1→L2: 100, L2→L3: 300, L3→L4: 600, …)
- Level and XP are **derived client-side** from the `completions` table — do not store a denormalized counter, it will drift
- Level-up: brief full-screen celebration, confetti or similar, dismissible in one tap. Once per level, not repeatable.

### Streaks
- A day counts toward the streak if **at least one** task was completed
- Deliberately generous — the user has stated procrastination is the real enemy, so the streak should reward showing up at all, not perfection
- **One grace day per week:** a single missed day doesn't reset the streak, it consumes the week's grace. Two misses in a week resets. This is the single most important design detail in the app: an all-or-nothing streak that dies on day 9 is an abandonment trigger.

### Multipliers
- 7-day streak → 1.25× XP
- 30-day streak → 1.5× XP
- Applied at completion time, stored in `completions.xp_awarded` so history stays accurate

### Co-op mechanics (the real motivator here)
- **Same-day bonus:** if both users complete at least one task on the same day, both get +15 XP. Show it explicitly: "Both in today 🤝 +15"
- **Weekly party goal:** combined task completions across both users; a simple progress bar toward a weekly target (**[DECISION]** default target: 80% of combined scheduled tasks). Hit it → both get a bonus.
- **Nudge button:** if the other person has 0 completions and it's past midday their time, show a "Poke" button that sends… **[DECISION]** simplest version: writes a `day_notes` row the other person sees on next load. No push notifications in v1.

### Achievements
Compute client-side from completion history. Show as a grid of badges, locked ones greyed out.

| Badge | Condition |
|---|---|
| First Step | 1st completion ever |
| Consistent | 7-day streak |
| Committed | 30-day streak |
| Early Bird | 10 completions logged before 07:00 |
| Scholar | 10 RL-category tasks |
| Mover | 20 Exercise-category tasks |
| Comeback | Resumed after a 3+ day gap |
| In Sync | 10 same-day-both bonuses |
| Phase Clear | All `!once` tasks in a phase done |

### Backfill rule (anti-cheat-lite)
Past days can be checked off — real life needs this — but only **within the last 3 days**, and backfilled completions award 50% XP. Keeps honesty without being punitive. Show the reduced XP clearly so it doesn't feel like a bug.

---

## 7. UI direction

- **Dense but calm.** Today screen should fit on one mobile screen without scrolling for a typical 4–6 task day.
- **Dark mode default**, light mode respected via `prefers-color-scheme`.
- Two user colors, fixed and consistent everywhere (calendar dots, progress bars, avatars).
- Completion interaction: tap → checkbox fills, row dims slightly, XP number floats up and fades. Fast, ~200ms, no blocking spinner.
- **No explanatory text blocks anywhere.** No onboarding tour, no tooltips-as-documentation, no empty-state paragraphs. An empty state is one line and a button.
- Mobile-first layout — the Today screen will mostly be opened on a phone at 4am.
- Use system font stack; don't load a webfont.

---

## 8. Deployment

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Repo visibility

The repo is **public**. This is safe and intentional: the only credential in the bundle is the Supabase anon key, which is designed to be public — Row Level Security is what protects the data, not obscurity of the source. Auth behaves identically either way.

(A private repo would also work but requires GitHub Pro; on GitHub Free, Pages only publishes from public repositories. Either way the *published site* is publicly reachable — a private Pages site requires an Enterprise Cloud organization. Nothing in this spec should assume the site URL is secret.)

**Setup checklist for the user:**
1. Create repo `routine` under `denizberkin` (public)
2. Settings → Pages → Source: **GitHub Actions**
3. Settings → Secrets and variables → Actions → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Create the Supabase project, run the SQL from §3, create the two users
5. Push to `main`

Both env vars are also needed locally in `.env.local` (gitignored).

---

## 9. Build order

Ship in this order so it's usable early rather than perfect late.

1. Vite + React + TS + Tailwind scaffold, `base: '/routine/'`, HashRouter, deploy workflow → confirm the blank app is live at the URL
2. Supabase client + login page + auth guard + session persistence
3. Schema + RLS applied; both users created
4. Markdown parser + `/plan` screen with preview
5. `/` Today screen: task list, completion writes, XP total
6. Realtime subscription; other user's progress live
7. `/calendar` with both users' day markers + day detail panel + backfill
8. Gamification layer: levels, streaks w/ grace day, multipliers, co-op bonus
9. Achievements grid
10. Polish: animations, level-up celebration, empty states

Stop after step 6 is a genuinely usable app. Everything after is motivation surface.

---

## 10. Out of scope for v1

Do not build these unless asked: push notifications, mobile apps, more than two users, task editing UI (markdown is the source of truth — re-paste to change), image uploads, social feed, public profiles, data export.
