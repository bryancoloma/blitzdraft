-- ============================================================
-- Super Bowl Squares — team colors + admin notifications
-- Run ONCE in Supabase SQL Editor (paste the contents, not the filename).
-- Safe to re-run.
-- ============================================================

alter table public.squares_settings
  add column if not exists top_color     text default '#1e3a8a',  -- number bar across the top
  add column if not exists side_color    text default '#1e3a8a',  -- number bar down the side
  add column if not exists admin_seen_at timestamptz;             -- last time admin cleared notifications

-- quarter winners shown beside the board, typed in by the admin
-- e.g. {"q1": "Mike", "q1r": "Sara", ...}  (r = reverse)
alter table public.squares_settings
  add column if not exists winners jsonb not null default '{}'::jsonb;
