export type Slot = 'u1' | 'u2'

export interface Profile {
  id: string
  display_name: string
  avatar_emoji: string
  created_at: string
}

export interface Routine {
  id: string
  owner_id: string
  title: string
  source_markdown: string
  is_active: boolean
  created_at: string
}

export type Recurrence = 'daily' | `days:${string}` | `weekly:${number}` | 'once'

export interface Task {
  id: string
  routine_id: string
  title: string
  category: string
  phase: string | null
  xp: number
  recurrence: Recurrence
  starts_on: string // YYYY-MM-DD
  ends_on: string | null
  sort_order: number
}

export interface Completion {
  id: string
  task_id: string
  user_id: string
  due_date: string // YYYY-MM-DD
  xp_awarded: number
  completed_at: string
}

export interface DayNote {
  id: string
  user_id: string
  day: string
  body: string
  created_at: string
}
