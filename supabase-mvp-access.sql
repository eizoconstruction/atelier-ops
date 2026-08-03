-- Atelier Ops - accès MVP pour site privé
--
-- À utiliser seulement pendant la phase MVP, parce que l'app est déjà protégée
-- par l'accès privé du site. Plus tard, remplacer ces politiques par une vraie
-- authentification Supabase admin/employés.

alter table public.time_entries add column if not exists employee_name text;
alter table public.time_entries add column if not exists job_name text;

alter table public.mileage_trips add column if not exists employee_name text;
alter table public.mileage_trips add column if not exists vehicle_name text;
alter table public.mileage_trips add column if not exists job_name text;

drop policy if exists "mvp_anon_read_profiles" on public.profiles;
create policy "mvp_anon_read_profiles" on public.profiles
  for select to anon using (true);

drop policy if exists "mvp_anon_read_clients" on public.clients;
create policy "mvp_anon_read_clients" on public.clients
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_clients" on public.clients;
create policy "mvp_anon_insert_clients" on public.clients
  for insert to anon with check (true);

drop policy if exists "mvp_anon_read_jobs" on public.jobs;
create policy "mvp_anon_read_jobs" on public.jobs
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_jobs" on public.jobs;
create policy "mvp_anon_insert_jobs" on public.jobs
  for insert to anon with check (true);
drop policy if exists "mvp_anon_update_jobs" on public.jobs;
create policy "mvp_anon_update_jobs" on public.jobs
  for update to anon using (true) with check (true);

drop policy if exists "mvp_anon_read_time" on public.time_entries;
create policy "mvp_anon_read_time" on public.time_entries
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_time" on public.time_entries;
create policy "mvp_anon_insert_time" on public.time_entries
  for insert to anon with check (true);
drop policy if exists "mvp_anon_update_time" on public.time_entries;
create policy "mvp_anon_update_time" on public.time_entries
  for update to anon using (true) with check (true);

drop policy if exists "mvp_anon_read_vehicles" on public.vehicles;
create policy "mvp_anon_read_vehicles" on public.vehicles
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_vehicles" on public.vehicles;
create policy "mvp_anon_insert_vehicles" on public.vehicles
  for insert to anon with check (true);
drop policy if exists "mvp_anon_update_vehicles" on public.vehicles;
create policy "mvp_anon_update_vehicles" on public.vehicles
  for update to anon using (true) with check (true);

drop policy if exists "mvp_anon_read_mileage" on public.mileage_trips;
create policy "mvp_anon_read_mileage" on public.mileage_trips
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_mileage" on public.mileage_trips;
create policy "mvp_anon_insert_mileage" on public.mileage_trips
  for insert to anon with check (true);
drop policy if exists "mvp_anon_update_mileage" on public.mileage_trips;
create policy "mvp_anon_update_mileage" on public.mileage_trips
  for update to anon using (true) with check (true);

drop policy if exists "mvp_anon_read_files" on public.job_files;
create policy "mvp_anon_read_files" on public.job_files
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_files" on public.job_files;
create policy "mvp_anon_insert_files" on public.job_files
  for insert to anon with check (true);

drop policy if exists "mvp_anon_read_logs" on public.job_log_entries;
create policy "mvp_anon_read_logs" on public.job_log_entries
  for select to anon using (true);
drop policy if exists "mvp_anon_insert_logs" on public.job_log_entries;
create policy "mvp_anon_insert_logs" on public.job_log_entries
  for insert to anon with check (true);
