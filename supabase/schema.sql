-- Routine — schema + RLS (spec §3). Run once in the Supabase SQL editor.
-- Both users can read everything; each can only write their own rows.

-- Profiles: one row per user, created by hand for the two of us
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

-- Row Level Security -------------------------------------------------------

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

-- Realtime ------------------------------------------------------------------
-- The app subscribes to live changes on these two tables (spec §4, §6).

alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table day_notes;
