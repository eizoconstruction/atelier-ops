create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'employee')),
  phone text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  billing_address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  address text,
  status text not null default 'Planifié',
  scheduled_date date,
  assigned_team text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  summary text,
  drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  category text not null check (category in ('document', 'plan', 'quote', 'photo')),
  title text not null,
  url text,
  created_at timestamptz not null default now()
);

create table public.job_log_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  work_date date not null,
  hours numeric(5,2) not null,
  status text not null default 'À approuver',
  notes text,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.mileage_trips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  trip_date date not null,
  start_label text,
  end_label text,
  distance_km numeric(8,2) not null default 0,
  trip_type text not null check (trip_type in ('Professionnel', 'Personnel')),
  reimbursement_rate numeric(5,2) not null default 0.70,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.job_files enable row level security;
alter table public.job_log_entries enable row level security;
alter table public.time_entries enable row level security;
alter table public.vehicles enable row level security;
alter table public.mileage_trips enable row level security;

create policy "authenticated_read_all" on public.clients for select to authenticated using (true);
create policy "authenticated_read_jobs" on public.jobs for select to authenticated using (true);
create policy "authenticated_read_files" on public.job_files for select to authenticated using (true);
create policy "authenticated_read_logs" on public.job_log_entries for select to authenticated using (true);
create policy "authenticated_read_time" on public.time_entries for select to authenticated using (true);
create policy "authenticated_read_vehicles" on public.vehicles for select to authenticated using (true);
create policy "authenticated_read_mileage" on public.mileage_trips for select to authenticated using (true);

create policy "admin_write_clients" on public.clients for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_jobs" on public.jobs for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_files" on public.job_files for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_logs" on public.job_log_entries for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_time" on public.time_entries for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_vehicles" on public.vehicles for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "admin_write_mileage" on public.mileage_trips for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
