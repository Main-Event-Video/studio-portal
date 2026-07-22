-- Adds per-render parameters (pacing + per-photo framing adjustments).
-- Additive; safe on the shared project.
alter table public.studio_montages
  add column if not exists params jsonb not null default '{}'::jsonb;
