-- ============================================================
-- Super Bowl Squares — tables, RLS policies, grants
-- Run ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / drops policies before recreating).
-- ============================================================

-- 1. settings: exactly one row (id = 1) that controls the whole board
create table if not exists public.squares_settings (
  id            int primary key default 1 check (id = 1),  -- check forces a single row
  enabled       boolean not null default false,            -- admin on/off switch
  sb_logo_url   text,
  top_team      text,
  top_logo_url  text,
  side_team     text,
  side_logo_url text,
  top_numbers   int[],          -- 10 digits 0-9 in random order, null until Randomize
  side_numbers  int[],
  price_per_box numeric(6,2) not null default 0
);

insert into public.squares_settings (id) values (1) on conflict (id) do nothing;

-- 2. one row per claimed box
create table if not exists public.squares (
  id           bigint generated always as identity primary key,
  row_num      int  not null check (row_num between 0 and 9),
  col_num      int  not null check (col_num between 0 and 9),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  unique (row_num, col_num)     -- no double-booking a box
);

-- 3. Row Level Security
alter table public.squares_settings enable row level security;
alter table public.squares          enable row level security;

drop policy if exists "squares_settings read"         on public.squares_settings;
drop policy if exists "squares_settings admin update" on public.squares_settings;
drop policy if exists "squares read"                  on public.squares;
drop policy if exists "squares insert own"            on public.squares;
drop policy if exists "squares admin delete"          on public.squares;

-- everyone logged in can read the settings (needed to show/hide the nav link)
create policy "squares_settings read" on public.squares_settings
  for select to authenticated using (true);

-- only the admin can change settings (toggle, logos, numbers, price)
create policy "squares_settings admin update" on public.squares_settings
  for update to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- everyone logged in can see the board
create policy "squares read" on public.squares
  for select to authenticated using (true);

-- players claim boxes only as themselves, with their real display name
-- (not the "Player" signup placeholder), only while the board is turned on,
-- and only BEFORE the admin draws the numbers
create policy "squares insert own" on public.squares
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and display_name = (select p.display_name from public.profiles p where p.id = auth.uid())
    and btrim(display_name) not in ('', 'Player')
    and exists (
      select 1 from public.squares_settings s
      where s.id = 1 and s.enabled
        and s.top_numbers is null and s.side_numbers is null
    )
  );

-- NO update policy → nobody can edit a box after it's saved (locked)
-- only the admin can remove a box (if someone backs out)
create policy "squares admin delete" on public.squares
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 4. Grants for the Data API (required for tables created after Oct 30 2026).
--    RLS above still decides WHICH rows each person can touch.
grant select, update         on public.squares_settings to authenticated;
grant select, insert, delete on public.squares          to authenticated;
