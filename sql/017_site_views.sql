-- 017: maineventstudio.com visitor tracking for the admin "Site analytics" panel.
-- Rows are written ONLY by /api/site/hit (service role) and read ONLY by
-- /api/admin/site-stats (service role, admin-checked). RLS on with no policies =
-- browsers can never read or write it directly. No raw IPs are stored: visitor is
-- a salted hash, location is city-level from Vercel's geo headers.
create table if not exists public.studio_site_views (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'view',   -- 'view' (page view) | 'click' (tracked button)
  path text,                           -- page path on maineventstudio.com
  label text,                          -- for clicks: which button (mevid, donate, contact, phone_email, portal)
  visitor text,                        -- salted hash, 16 chars
  referrer text,                       -- referring host for views (null = direct)
  device text,                         -- mobile | desktop
  country text, region text, city text,
  lat double precision, lng double precision
);
create index if not exists studio_site_views_created_idx on public.studio_site_views (created_at desc);
create index if not exists studio_site_views_visitor_idx on public.studio_site_views (visitor);
alter table public.studio_site_views enable row level security;
grant insert, select on table public.studio_site_views to service_role;
grant usage, select on sequence public.studio_site_views_id_seq to service_role;
