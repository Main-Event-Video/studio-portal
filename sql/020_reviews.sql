-- 020: Reviews (Josh + Robyn signed off 11/17). Clients get a "How did we do?"
-- email with a private link (/review?c=<token>&stars=n). What they send lands in
-- studio_reviews as 'waiting' and is only shown on /testimonials after an admin
-- clicks Approve & post. Admins can also add a review by hand (source='manual').
-- Server routes only (service role). RLS on with no policies = browsers can
-- never read or write these tables directly; the public testimonials feed is
-- served by an API route that returns approved rows only.

create table if not exists public.studio_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid references public.studio_clients(id) on delete set null,
  source text not null default 'client' check (source in ('client', 'manual')),
  stars integer not null check (stars between 1 and 5),
  body text not null,                       -- what shows on the site (editable)
  original_body text,                       -- exactly what the client typed
  name_given text not null,                 -- the name they entered
  name_display text not null default 'first'
    check (name_display in ('full', 'first', 'initials')),
  event_label text,                         -- e.g. "Bar Mitzvah"
  ok_to_post boolean not null default false,
  status text not null default 'waiting'
    check (status in ('waiting', 'posted', 'hidden')),
  posted_at timestamptz
);
create index if not exists studio_reviews_status_idx on public.studio_reviews (status, created_at desc);
create index if not exists studio_reviews_client_idx on public.studio_reviews (client_id);

-- Per-client request tracking for the ★ Ask for review pill.
alter table public.studio_clients add column if not exists review_token text unique;
alter table public.studio_clients add column if not exists review_asked_at timestamptz;
alter table public.studio_clients add column if not exists review_reminded_at timestamptz;
alter table public.studio_clients add column if not exists reviewed_at timestamptz;

alter table public.studio_reviews enable row level security;
grant select, insert, update, delete on table public.studio_reviews to service_role;
