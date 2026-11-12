-- ============================================================================
-- Portfolio and office-files disclosure. Already applied; kept as the record.
--
-- One form per person. The person fills it in; an admin or a Principal
-- Architect approves or declines each line. The trigger is what stops anyone
-- approving their own form: whenever the owner (or anyone who is not a
-- reviewer) writes the row, every decision is wiped and it goes back to
-- "Submitted".
-- ============================================================================

create table if not exists public.portfolio_disclosures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references public.profiles(id) on delete cascade,
  projects     jsonb not null default '[]'::jsonb,   -- [{id, name, use}]
  files        jsonb not null default '[]'::jsonb,   -- [{id, what, kind, where}]
  other_items  text  not null default '',
  decisions    jsonb not null default '{}'::jsonb,   -- {itemId: "approved" | "declined"}
  status       text  not null default 'Submitted',
  review_note  text,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.is_disclosure_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(active, true) and not coalesce(removed, false)
      and (role = 'Admin' or rank = 'Principal Architect')
  );
$$;

create or replace function public.portfolio_disclosures_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'A disclosure cannot be moved to another person.';
  end if;
  if auth.uid() is not null
     and (not public.is_disclosure_reviewer() or auth.uid() = new.user_id) then
    new.decisions   := '{}'::jsonb;
    new.status      := 'Submitted';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger portfolio_disclosures_guard_trg
  before insert or update on public.portfolio_disclosures
  for each row execute function public.portfolio_disclosures_guard();

alter table public.portfolio_disclosures enable row level security;

create policy pd_select on public.portfolio_disclosures
  for select using (user_id = auth.uid() or public.is_disclosure_reviewer());
create policy pd_insert on public.portfolio_disclosures
  for insert with check (user_id = auth.uid());
create policy pd_update on public.portfolio_disclosures
  for update using (user_id = auth.uid() or public.is_disclosure_reviewer())
  with check (user_id = auth.uid() or public.is_disclosure_reviewer());
create policy pd_delete on public.portfolio_disclosures
  for delete using (public.is_admin());
