-- =====================================================================
-- Atelier Ops v2 : migration SANS PERTE DE DONNÉES
-- ---------------------------------------------------------------------
-- À exécuter une seule fois dans Supabase > SQL Editor, après avoir
-- réactivé le projet. Le script :
--   * n'efface aucune table ni aucune ligne ;
--   * ajoute seulement des colonnes, des tables et des règles d'accès ;
--   * peut être relancé sans danger (if not exists / drop policy if exists).
-- Les seules choses retirées sont les anciennes règles d'accès
-- « mvp_anon_* » qui laissaient n'importe qui lire/écrire sans login.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Fonction utilitaire : l'utilisateur connecté est-il admin ?
--    (security definer = évite la récursion des règles sur profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------------
-- 2. Colonnes ajoutées aux tables existantes
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists title text,
  add column if not exists hourly_cost numeric(8,2) not null default 0,   -- coût horaire (salaire + charges)
  add column if not exists active boolean not null default true;

alter table public.clients
  add column if not exists updated_at timestamptz not null default now();

alter table public.jobs
  add column if not exists end_date date,
  add column if not exists progress int not null default 0 check (progress between 0 and 100),
  add column if not exists crew_ids uuid[] not null default '{}',
  add column if not exists invoice_number text,
  add column if not exists invoiced_at date,
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists paid_at date,
  add column if not exists notes text;

alter table public.time_entries
  add column if not exists employee_name text,      -- ancien format (rangées créées avant la v2)
  add column if not exists job_name text,           -- ancien format
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists break_minutes int not null default 0,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.vehicles
  add column if not exists notes text;

alter table public.mileage_trips
  add column if not exists employee_name text,      -- ancien format
  add column if not exists vehicle_name text,       -- ancien format
  add column if not exists job_name text,           -- ancien format
  add column if not exists source text not null default 'manuel',   -- 'manuel' | 'gps' | 'odometre'
  add column if not exists start_odometer numeric(10,1),
  add column if not exists end_odometer numeric(10,1),
  add column if not exists notes text;

alter table public.job_files
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;

-- Catégories de fichiers élargies (contrat, facture, autre)
alter table public.job_files drop constraint if exists job_files_category_check;
alter table public.job_files add constraint job_files_category_check
  check (category in ('document', 'plan', 'quote', 'photo', 'contract', 'invoice', 'other'));

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Nouvelles tables
-- ---------------------------------------------------------------------
create table if not exists public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null default 'Matériaux'
    check (category in ('Matériaux', 'Sous-traitant', 'Location', 'Permis', 'Transport', 'Autre')),
  supplier text,
  description text,
  amount numeric(12,2) not null default 0,        -- avant taxes
  receipt_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text,
  job_id uuid references public.jobs(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  status text not null default 'Brouillon' check (status in ('Brouillon', 'Envoyé', 'Accepté', 'Refusé')),
  inputs jsonb not null default '{}',   -- paramètres du calculateur
  lines jsonb not null default '[]',    -- lignes du devis [{label, qty, unit, price}]
  cost numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tps numeric(12,2) not null default 0,
  tvq numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  job_id uuid references public.jobs(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'Rendez-vous' check (kind in ('Rendez-vous', 'Livraison', 'Inspection', 'Visite', 'Autre')),
  notes text,
  created_at timestamptz not null default now()
);

-- calendar_events peut déjà exister (migration « atelier_ops_tasks_events_team_progress »,
-- avec start_time/end_time en texte et une colonne color) : on complète sans rien retirer.
alter table public.calendar_events
  add column if not exists employee_id uuid references public.profiles(id) on delete set null,
  add column if not exists kind text not null default 'Rendez-vous',
  add column if not exists notes text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'color') then
    alter table public.calendar_events alter column color drop not null;
  end if;
end $$;

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Eizo Construction',
  company_address text,
  company_phone text,
  company_email text,
  tps_number text,
  tvq_number text,
  tps_rate numeric(6,3) not null default 5.000,
  tvq_rate numeric(6,3) not null default 9.975,
  mileage_rate numeric(5,2) not null default 0.70,
  default_margin numeric(5,2) not null default 25,
  default_hourly_rate numeric(8,2) not null default 75,
  quote_prefix text not null default 'D-',
  invoice_prefix text not null default 'F-',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Profil créé automatiquement quand un compte est ajouté dans
--    Supabase > Authentication > Add user. Rôle « employee » par défaut.
--    Le premier compte du projet devient admin s'il n'y a aucun admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'employee' else 'admin' end,
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Remplir le courriel des profils existants
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- ---------------------------------------------------------------------
-- 5. Règles d'accès (RLS)
--    admin   : tout
--    employé : lit jobs/clients/véhicules/calendrier/employés,
--              gère SES heures (tant qu'elles ne sont pas approuvées)
--              et SES trajets ; ajoute fichiers et notes de chantier.
--    Personne sans login : rien.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  -- retire toutes les anciennes règles des tables de l'app
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','clients','jobs','job_files','job_log_entries','time_entries',
                        'vehicles','mileage_trips','job_expenses','quotes','calendar_events','app_settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.job_expenses enable row level security;
alter table public.quotes enable row level security;
alter table public.calendar_events enable row level security;
alter table public.app_settings enable row level security;

-- profiles
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_admin_write on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tables lisibles par tous les connectés, modifiables par l'admin
create policy clients_read on public.clients for select to authenticated using (true);
create policy clients_admin on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy jobs_read on public.jobs for select to authenticated using (true);
create policy jobs_admin on public.jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vehicles_read on public.vehicles for select to authenticated using (true);
create policy vehicles_admin on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_read on public.calendar_events for select to authenticated using (true);
create policy events_admin on public.calendar_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_admin on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- fichiers et journal : tout connecté peut lire et ajouter, admin ou auteur peut supprimer
create policy files_read on public.job_files for select to authenticated using (true);
create policy files_insert on public.job_files for insert to authenticated with check (true);
create policy files_delete on public.job_files for delete to authenticated using (public.is_admin() or uploaded_by = auth.uid());
create policy files_admin_update on public.job_files for update to authenticated using (public.is_admin());
create policy logs_read on public.job_log_entries for select to authenticated using (true);
create policy logs_insert on public.job_log_entries for insert to authenticated with check (author_id = auth.uid() or public.is_admin());
create policy logs_delete on public.job_log_entries for delete to authenticated using (public.is_admin() or author_id = auth.uid());

-- finances : admin seulement
create policy expenses_admin on public.job_expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy quotes_admin on public.quotes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- heures : employé = ses lignes, non approuvées ; admin = tout
create policy time_read on public.time_entries for select to authenticated using (public.is_admin() or employee_id = auth.uid());
create policy time_admin on public.time_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy time_own_insert on public.time_entries for insert to authenticated
  with check (employee_id = auth.uid() and status = 'À approuver');
create policy time_own_update on public.time_entries for update to authenticated
  using (employee_id = auth.uid() and status = 'À approuver')
  with check (employee_id = auth.uid() and status = 'À approuver');
create policy time_own_delete on public.time_entries for delete to authenticated
  using (employee_id = auth.uid() and status = 'À approuver');

-- kilométrage : employé = ses trajets ; admin = tout
create policy mileage_read on public.mileage_trips for select to authenticated using (public.is_admin() or employee_id = auth.uid());
create policy mileage_admin on public.mileage_trips for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mileage_own_insert on public.mileage_trips for insert to authenticated with check (employee_id = auth.uid());
create policy mileage_own_update on public.mileage_trips for update to authenticated using (employee_id = auth.uid()) with check (employee_id = auth.uid());
create policy mileage_own_delete on public.mileage_trips for delete to authenticated using (employee_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. Stockage des fichiers (photos, plans, contrats, reçus)
--    Bucket privé « job-files » ; liens temporaires signés côté app.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-files', 'job-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists job_files_read on storage.objects;
drop policy if exists job_files_upload on storage.objects;
drop policy if exists job_files_remove on storage.objects;
create policy job_files_read on storage.objects for select to authenticated using (bucket_id = 'job-files');
create policy job_files_upload on storage.objects for insert to authenticated with check (bucket_id = 'job-files');
create policy job_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'job-files' and (public.is_admin() or owner = auth.uid()));

-- ---------------------------------------------------------------------
-- 7. Index utiles
-- ---------------------------------------------------------------------
create index if not exists time_entries_employee_date on public.time_entries (employee_id, work_date);
create index if not exists time_entries_job on public.time_entries (job_id);
create index if not exists mileage_employee_date on public.mileage_trips (employee_id, trip_date);
create index if not exists job_expenses_job on public.job_expenses (job_id);
create index if not exists job_files_job on public.job_files (job_id);
create index if not exists events_date on public.calendar_events (event_date);

-- ---------------------------------------------------------------------
-- 8. Durcissement demandé par l'outil de sécurité de Supabase
-- ---------------------------------------------------------------------
alter function public.touch_updated_at() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
