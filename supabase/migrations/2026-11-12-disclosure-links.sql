-- ============================================================================
-- Login-less disclosure links. Already applied; kept as the record.
--
-- A former employee has no login. An admin makes them a link carrying a long
-- random token; the two functions below are the only things that token can
-- reach: read that one person's own form, and submit it. A submission
-- through a link always goes back to "Submitted" with every decision cleared.
-- ============================================================================

create table if not exists public.disclosure_links (
  token      text primary key check (length(token) >= 32),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.disclosure_links enable row level security;
create policy dl_admin_all on public.disclosure_links
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.disclosure_link_open(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.disclosure_links;
begin
  select * into l from public.disclosure_links where token = p_token and expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'user', (select jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role, 'rank', p.rank, 'empId', p.emp_id)
             from public.profiles p where p.id = l.user_id),
    'designation', (select h.designation from public.staff_hr_details h where h.user_id = l.user_id),
    'expiresAt', l.expires_at,
    'disclosure', (select to_jsonb(d) || jsonb_build_object('reviewer_name', (select r.name from public.profiles r where r.id = d.reviewed_by))
                   from public.portfolio_disclosures d where d.user_id = l.user_id)
  );
end;
$$;

create or replace function public.disclosure_link_submit(p_token text, p_projects jsonb, p_files jsonb, p_other text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.disclosure_links;
begin
  select * into l from public.disclosure_links where token = p_token and expires_at > now();
  if not found then raise exception 'This link is not valid or has expired.'; end if;
  if jsonb_typeof(p_projects) <> 'array' or jsonb_typeof(p_files) <> 'array'
     or jsonb_array_length(p_projects) > 60 or jsonb_array_length(p_files) > 60
     or length(p_projects::text) > 40000 or length(p_files::text) > 40000
     or length(coalesce(p_other, '')) > 5000 then
    raise exception 'The form is too long or not in the expected shape.';
  end if;
  insert into public.portfolio_disclosures (user_id, projects, files, other_items)
  values (l.user_id, p_projects, p_files, coalesce(p_other, ''))
  on conflict (user_id) do update set
    projects = excluded.projects, files = excluded.files, other_items = excluded.other_items,
    decisions = '{}'::jsonb, status = 'Submitted', review_note = null,
    reviewed_by = null, reviewed_at = null, submitted_at = now();
  return public.disclosure_link_open(p_token);
end;
$$;

grant execute on function public.disclosure_link_open(text) to anon, authenticated;
grant execute on function public.disclosure_link_submit(text, jsonb, jsonb, text) to anon, authenticated;
