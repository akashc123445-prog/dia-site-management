-- ============================================================================
-- Salary and HR details per employee, for salary slips and experience
-- certificates. Already applied; kept as the record of what was run.
--
-- Deliberately a table of its own rather than more columns on profiles:
-- everyone on staff can read profiles, and nobody but an admin should be
-- able to read what a colleague is paid.
-- ============================================================================

create table if not exists public.staff_hr_details (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  title          text not null default '',      -- Mr. / Ms. / blank
  designation    text not null default '',
  monthly_salary numeric not null default 0,    -- gross, per month
  basic          numeric not null default 0,
  hra            numeric not null default 0,
  conveyance     numeric not null default 0,    -- the rest is special allowance
  pf             numeric not null default 0,    -- deductions, per month
  esi            numeric not null default 0,
  prof_tax       numeric not null default 0,
  tds            numeric not null default 0,
  last_working_day date,
  updated_by     uuid references public.profiles(id),
  updated_at     timestamptz not null default now()
);

alter table public.staff_hr_details enable row level security;

create policy shd_admin_all on public.staff_hr_details
  for all using (is_admin()) with check (is_admin());
