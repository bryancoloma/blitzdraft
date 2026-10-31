-- ============================================================
-- Super Bowl Squares — logo storage (build step 3)
-- Run ONCE in Supabase SQL Editor (paste the contents, not the filename).
-- Safe to re-run.
-- ============================================================

-- a PUBLIC bucket: anyone can view the images (they're just team logos),
-- but only the admin can upload / replace / delete (policies below)
insert into storage.buckets (id, name, public)
values ('squares', 'squares', true)
on conflict (id) do nothing;

drop policy if exists "squares logos admin insert" on storage.objects;
drop policy if exists "squares logos admin update" on storage.objects;
drop policy if exists "squares logos admin delete" on storage.objects;

create policy "squares logos admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'squares'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "squares logos admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'squares'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "squares logos admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'squares'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- admin can LIST the bucket's files (needed by the Reset button to delete every logo).
-- Viewing images by URL doesn't need this — the bucket is public.
drop policy if exists "squares logos admin list" on storage.objects;

create policy "squares logos admin list" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'squares'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
