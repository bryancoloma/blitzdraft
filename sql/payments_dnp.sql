-- ============================================================
-- Payments — "DNP" (did not play) weeks
-- Run ONCE in Supabase SQL Editor (paste the contents, not the filename).
-- Safe to re-run.
-- ============================================================

-- a week marked DNP never counts as owed.
-- each payments row is now one of: paid / DNP / (neither = owes $5)
alter table public.payments
  add column if not exists dnp boolean not null default false;
