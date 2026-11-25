-- Flag test accounts so the Season, Group Picks and Admin pages list them last.
-- Already applied to Supabase on 2026-11-24. Safe to re-run.
alter table public.profiles add column if not exists is_test boolean not null default false;
update public.profiles set is_test = true where display_name = 'Test User';
