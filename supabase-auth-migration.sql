-- Atelier Ops - migration vers l'authentification réelle
--
-- À exécuter APRÈS avoir créé tes comptes utilisateurs dans Supabase Auth
-- (voir AUTH-SETUP.md). Ce script retire l'accès anonyme temporaire du MVP
-- et le remplace par un accès basé sur le compte connecté :
--   - admin  : accès complet en lecture/écriture
--   - employé : lit les jobs/clients/véhicules, gère seulement SES heures
--               et SES trajets de kilométrage

-- 1) Retirer toutes les politiques "mvp_anon_*" (accès anonyme ouvert)
drop policy if exists "mvp_anon_read_profiles" on public.profiles;
drop policy if exists "mvp_anon_read_clients" on public.clients;
drop policy if exists "mvp_anon_insert_clients" on public.clients;
drop policy if exists "mvp_anon_read_jobs" on public.jobs;
drop policy if exists "mvp_anon_insert_jobs" on public.jobs;
drop policy if exists "mvp_anon_update_jobs" on public.jobs;
drop policy if exists "mvp_anon_read_time" on public.time_entries;
drop policy if exists "mvp_anon_insert_time" on public.time_entries;
drop policy if exists "mvp_anon_update_time" on public.time_entries;
drop policy if exists "mvp_anon_read_vehicles" on public.vehicles;
drop policy if exists "mvp_anon_insert_vehicles" on public.vehicles;
drop policy if exists "mvp_anon_update_vehicles" on public.vehicles;
drop policy if exists "mvp_anon_read_mileage" on public.mileage_trips;
drop policy if exists "mvp_anon_insert_mileage" on public.mileage_trips;
drop policy if exists "mvp_anon_update_mileage" on public.mileage_trips;
drop policy if exists "mvp_anon_read_files" on public.job_files;
drop policy if exists "mvp_anon_insert_files" on public.job_files;
drop policy if exists "mvp_anon_read_logs" on public.job_log_entries;
drop policy if exists "mvp_anon_insert_logs" on public.job_log_entries;

-- 2) Permettre à chaque utilisateur connecté de lire son propre profil
--    (nécessaire pour que l'app sache si la personne est admin ou employé)
drop policy if exists "self_read_profile" on public.profiles;
create policy "self_read_profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- 3) Employé : peut créer et lire SES propres feuilles de temps
drop policy if exists "employee_insert_own_time" on public.time_entries;
create policy "employee_insert_own_time" on public.time_entries
  for insert to authenticated with check (employee_id = auth.uid());

drop policy if exists "employee_update_own_time" on public.time_entries;
create policy "employee_update_own_time" on public.time_entries
  for update to authenticated using (employee_id = auth.uid()) with check (employee_id = auth.uid());

-- 4) Employé : peut créer et lire SES propres trajets de kilométrage
drop policy if exists "employee_insert_own_mileage" on public.mileage_trips;
create policy "employee_insert_own_mileage" on public.mileage_trips
  for insert to authenticated with check (employee_id = auth.uid());

drop policy if exists "employee_update_own_mileage" on public.mileage_trips;
create policy "employee_update_own_mileage" on public.mileage_trips
  for update to authenticated using (employee_id = auth.uid()) with check (employee_id = auth.uid());

-- Note : les politiques "authenticated_read_all" / "authenticated_read_time" /
-- "authenticated_read_mileage" du fichier supabase-schema.sql restent actives :
-- elles laissent tout utilisateur connecté LIRE l'ensemble des jobs/heures/trajets
-- (utile pour le tableau de bord et l'approbation). Seule l'ÉCRITURE est
-- maintenant restreinte : admin = tout, employé = seulement ses propres lignes.

-- Les politiques "admin_write_*" du fichier supabase-schema.sql restent actives
-- et donnent aux admins un accès complet en écriture sur toutes les tables.
