-- 018: Sample links (Josh 11/11). A library of sample clips uploaded once, and
-- any number of trackable links per clip to send prospective clients. Every real
-- open of a link emails info@ and bumps its open count. Optional per-link password.
-- Rows are read/written ONLY by server routes with the service role
-- (/api/admin/samples, /api/watch/[slug]). RLS on with no policies = browsers can
-- never read or write these tables directly.

create table if not exists public.studio_samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  filename text,
  r2_key text not null,
  content_type text,
  size_bytes bigint,
  duration_s numeric,
  thumb_key text,
  archived_at timestamptz
);

create table if not exists public.studio_sample_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sample_id uuid not null references public.studio_samples(id) on delete cascade,
  slug text not null unique,
  recipient text,
  title text,
  password text,
  opens integer not null default 0,
  last_opened_at timestamptz,
  disabled_at timestamptz,
  archived_at timestamptz
);
create index if not exists studio_sample_links_sample_idx on public.studio_sample_links (sample_id);

alter table public.studio_samples enable row level security;
alter table public.studio_sample_links enable row level security;
grant select, insert, update, delete on table public.studio_samples to service_role;
grant select, insert, update, delete on table public.studio_sample_links to service_role;

-- Counts one open atomically and hands back the new count plus the PREVIOUS open
-- time (for the "previous open" line in the email).
create or replace function public.studio_sample_open(p_link uuid)
returns table (opens integer, prev_opened_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with old as (select last_opened_at from public.studio_sample_links where id = p_link)
  update public.studio_sample_links l
     set opens = l.opens + 1, last_opened_at = now()
    from old
   where l.id = p_link
  returning l.opens, old.last_opened_at;
$$;
revoke all on function public.studio_sample_open(uuid) from public, anon, authenticated;
grant execute on function public.studio_sample_open(uuid) to service_role;
