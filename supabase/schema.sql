-- ============================================================================
-- Dia Site Management — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor
-- > New query > paste this whole file > Run).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles
-- One row per app user, linked 1:1 to auth.users. Created automatically by
-- the trigger below whenever someone signs up. New sign-ups start inactive
-- and unassigned — an Admin activates them and sets role/rank from the Team
-- page in the app.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'Supervisor' check (role in ('Admin', 'Accounts', 'Architect', 'Supervisor')),
  rank text check (rank in ('Principal Architect', 'Senior Architect', 'Junior Architect', 'Intern Architect')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helper functions used throughout RLS policies (security definer so they
-- can read profiles regardless of the caller's own row-level access).
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_role() = 'Admin', false);
$$;

create or replace function public.is_staff()
-- Admin or Accounts: full read visibility across every project.
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('Admin', 'Accounts'), false);
$$;

create or replace function public.is_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null,
  location text not null,
  type text not null,
  area numeric not null default 0,
  start_date date not null,
  planned_end date not null,
  actual_end date,
  pm text,
  supervisors uuid[] not null default '{}',
  architects uuid[] not null default '{}',
  contract_value numeric not null default 0,
  estimated_cost numeric not null default 0,
  status text not null default 'Not Started',
  created_at timestamptz not null default now()
);

create or replace function public.project_member(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and (auth.uid() = any(p.supervisors) or auth.uid() = any(p.architects))
  );
$$;

create or replace function public.project_supervisor(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.projects p where p.id = pid and auth.uid() = any(p.supervisors));
$$;

create or replace function public.project_architect(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.projects p where p.id = pid and auth.uid() = any(p.architects));
$$;

-- ----------------------------------------------------------------------------
-- tasks (construction timeline)
-- ----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase text not null,
  name text not null,
  start date,
  target date,
  actual date,
  status text not null default 'Not Started',
  pct integer not null default 0,
  assigned_to text,
  depends_on uuid
);

-- ----------------------------------------------------------------------------
-- design_phases + drawings (architecture workflow)
-- ----------------------------------------------------------------------------
create table public.design_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase text not null,
  start date,
  target date,
  actual date,
  status text not null default 'Not Started',
  pct integer not null default 0,
  assigned_to text,
  notes text,
  proof jsonb
);

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  design_phase_id uuid not null references public.design_phases (id) on delete cascade,
  name text not null,
  status text not null default 'Pending',
  proof jsonb,
  updated_at timestamptz,
  updated_by uuid references public.profiles (id)
);

-- ----------------------------------------------------------------------------
-- site_reports + photos
-- ----------------------------------------------------------------------------
create table public.site_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  supervisor_id uuid references public.profiles (id),
  date date not null,
  workers integer not null default 0,
  work_done text,
  work_in_progress text,
  work_planned text,
  materials_received text,
  materials_needed text,
  issues text,
  delays text,
  pct_complete integer not null default 0,
  remarks text,
  submitted_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  site_report_id uuid references public.site_reports (id) on delete set null,
  url text not null,
  caption text,
  category text,
  date date not null,
  uploaded_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  submitted_by uuid references public.profiles (id),
  date date not null,
  category text not null,
  description text not null,
  amount numeric not null,
  payment_method text,
  vendor text,
  invoice_no text,
  status text not null default 'Pending',
  approved_by uuid references public.profiles (id),
  rejection_reason text,
  submitted_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- issues
-- ----------------------------------------------------------------------------
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  supervisor_id uuid references public.profiles (id),
  date date not null,
  description text not null,
  severity text not null default 'Medium',
  status text not null default 'Open',
  submitted_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.design_phases enable row level security;
alter table public.drawings enable row level security;
alter table public.site_reports enable row level security;
alter table public.photos enable row level security;
alter table public.expenses enable row level security;
alter table public.issues enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles_select_all_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- projects -----------------------------------------------------------------
create policy "projects_select" on public.projects
  for select using (public.is_active() and (public.is_staff() or public.project_member(id)));

create policy "projects_admin_insert" on public.projects
  for insert with check (public.is_admin());

create policy "projects_admin_update" on public.projects
  for update using (public.is_admin());

-- tasks ----------------------------------------------------------------------
create policy "tasks_select" on public.tasks
  for select using (public.is_staff() or public.project_member(project_id));

create policy "tasks_write" on public.tasks
  for all using (public.is_admin() or public.project_supervisor(project_id))
  with check (public.is_admin() or public.project_supervisor(project_id));

-- design_phases ----------------------------------------------------------
create policy "design_phases_select" on public.design_phases
  for select using (public.is_staff() or public.project_member(project_id));

create policy "design_phases_write" on public.design_phases
  for all using (public.is_admin() or public.project_architect(project_id))
  with check (public.is_admin() or public.project_architect(project_id));

-- drawings -----------------------------------------------------------------
create policy "drawings_select" on public.drawings
  for select using (
    exists (
      select 1 from public.design_phases dp
      where dp.id = design_phase_id and (public.is_staff() or public.project_member(dp.project_id))
    )
  );

create policy "drawings_write" on public.drawings
  for all using (
    exists (
      select 1 from public.design_phases dp
      where dp.id = design_phase_id and (public.is_admin() or public.project_architect(dp.project_id))
    )
  )
  with check (
    exists (
      select 1 from public.design_phases dp
      where dp.id = design_phase_id and (public.is_admin() or public.project_architect(dp.project_id))
    )
  );

-- site_reports ---------------------------------------------------------
create policy "site_reports_select" on public.site_reports
  for select using (public.is_staff() or public.project_member(project_id));

create policy "site_reports_insert" on public.site_reports
  for insert with check (public.is_admin() or public.project_supervisor(project_id));

-- photos -----------------------------------------------------------------
create policy "photos_select" on public.photos
  for select using (public.is_staff() or public.project_member(project_id));

create policy "photos_insert" on public.photos
  for insert with check (public.is_admin() or public.project_supervisor(project_id));

-- expenses ---------------------------------------------------------------
create policy "expenses_select" on public.expenses
  for select using (public.is_staff() or public.project_member(project_id));

create policy "expenses_insert" on public.expenses
  for insert with check (public.is_staff() or public.project_supervisor(project_id));

create policy "expenses_update_approve" on public.expenses
  -- Only Admin/Accounts can change status, and never on their own submission.
  for update using (public.is_staff() and submitted_by <> auth.uid());

-- issues -------------------------------------------------------------------
create policy "issues_select" on public.issues
  for select using (public.is_staff() or public.project_member(project_id));

create policy "issues_insert" on public.issues
  for insert with check (public.is_admin() or public.project_supervisor(project_id));

-- ============================================================================
-- Storage buckets for proof-of-work photos/PDFs and daily site photos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', true)
on conflict (id) do nothing;

create policy "proofs_read_public" on storage.objects
  for select using (bucket_id = 'proofs');

create policy "proofs_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'proofs' and auth.role() = 'authenticated');

create policy "site_photos_read_public" on storage.objects
  for select using (bucket_id = 'site-photos');

create policy "site_photos_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'site-photos' and auth.role() = 'authenticated');

-- ============================================================================
-- Bootstrap: after your first sign-up in the app, run this once (with your
-- own email) in the SQL Editor to make yourself the first Admin — every
-- account after that gets approved from inside the app instead of SQL.
-- ============================================================================
-- update public.profiles set role = 'Admin', active = true where email = 'you@yourcompany.com';
