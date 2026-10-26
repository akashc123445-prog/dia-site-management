-- ============================================================================
-- Daily attendance reminders over WhatsApp.
--
-- Run this once in the Supabase SQL Editor. It is safe to run twice.
--
-- Part 2 at the bottom schedules the daily job and needs one value pasted in
-- (the service role key) — read the comment there before running it.
-- ============================================================================

-- ---- part 1: the tables ----------------------------------------------------

-- A WhatsApp number per person. Stored however it is typed and normalised to
-- Meta's format (919xxxxxxxxx) when a message is sent.
alter table public.profiles add column if not exists whatsapp text;

-- One row of settings for the whole office.
create table if not exists public.attendance_reminder_settings (
  id            boolean primary key default true check (id),
  enabled       boolean not null default false,
  send_at       time    not null default '10:15',
  -- Which Saturdays the office is closed, counted within the month.
  saturdays_off int[]   not null default '{2,4}',
  -- Kept so the portal can show the wording; the message Meta actually sends
  -- is the approved template of the same meaning.
  message       text    not null default
    'Hi {{name}}, you have not marked your attendance on the DIA portal yet today. Please mark in: https://diaretail.in/portal',
  template_name text    not null default 'attendance_reminder',
  template_lang text    not null default 'en',
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);

insert into public.attendance_reminder_settings (id) values (true)
  on conflict (id) do nothing;

-- Every attempt. The unique constraint is what stops anyone being messaged
-- twice in a day, and a failure stays visible instead of disappearing.
create table if not exists public.attendance_reminder_log (
  id       uuid primary key default gen_random_uuid(),
  date     date not null,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  channel  text not null default 'whatsapp',
  status   text not null,                 -- sending | sent | failed
  detail   text,
  sent_at  timestamptz not null default now(),
  unique (date, user_id, channel)
);

create index if not exists attendance_reminder_log_date_idx
  on public.attendance_reminder_log (date desc);

alter table public.attendance_reminder_settings enable row level security;
alter table public.attendance_reminder_log      enable row level security;

drop policy if exists ars_select on public.attendance_reminder_settings;
create policy ars_select on public.attendance_reminder_settings
  for select using (is_staff());

drop policy if exists ars_write on public.attendance_reminder_settings;
create policy ars_write on public.attendance_reminder_settings
  for all using (is_admin()) with check (is_admin());

-- The log is an administrative record; staff have no reason to read it.
drop policy if exists arl_select on public.attendance_reminder_log;
create policy arl_select on public.attendance_reminder_log
  for select using (is_admin());


-- ---- part 2: the daily schedule --------------------------------------------
--
-- Run this only after the edge function is deployed.
--
-- Replace PASTE_SERVICE_ROLE_KEY_HERE with the service_role key from
--   Supabase → Project Settings → API Keys.
-- That key is a full-access credential: paste it into the SQL Editor, run it,
-- and do not keep the filled-in version anywhere.
--
-- The job runs every ten minutes and the function itself decides whether it
-- is the right time, so the send time can be changed in the portal without
-- touching this schedule.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('attendance-reminder')
  where exists (select 1 from cron.job where jobname = 'attendance-reminder');

select cron.schedule(
  'attendance-reminder',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://zewbcjwelnutbjetiahp.supabase.co/functions/v1/attendance-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_KEY_HERE'
    ),
    body    := jsonb_build_object('action', 'run')
  );
  $$
);

-- To check it afterwards:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select * from public.attendance_reminder_log order by sent_at desc limit 20;
