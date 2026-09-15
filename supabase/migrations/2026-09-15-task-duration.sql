-- Timer support: optional length of a task in minutes (from the `~15` token in the plan markdown).
alter table tasks add column if not exists duration_min int;
