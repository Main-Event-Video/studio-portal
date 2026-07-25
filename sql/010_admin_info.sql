-- =============================================================
-- MAIN EVENT STUDIO — private admin info sheet per client (#new)
-- Run in Supabase SQL Editor. SAFE: additive only — one nullable JSONB column on
-- studio_clients. Admin-only (never returned to a client portal). Nothing else
-- is changed or dropped.
--
-- Holds the studio's internal record for each client: honoree, contract/payment
-- amounts + dates, portal credentials, referral, notes, etc. Stored as one JSON
-- blob so fields can be added later without further migrations.
-- =============================================================

alter table public.studio_clients
  add column if not exists admin_info jsonb;

comment on column public.studio_clients.admin_info is
  'Private admin-only info sheet (contract, payments, contacts, notes). Never exposed to the client portal.';

-- Two new questionnaire fields the client fills in (DJ + planner). Additive.
alter table public.studio_intake
  add column if not exists dj_contact text;
alter table public.studio_intake
  add column if not exists planner_contact text;
