-- 019: Multi-clip sample links (Josh 11/11). One link can carry several clips;
-- the client gets a list to choose from. sample_ids holds them IN ORDER (the
-- order Josh tapped them); sample_id stays as the first clip so older code and
-- the foreign key keep working. plays = { "<sample uuid>": count } per clip.
alter table public.studio_sample_links add column if not exists sample_ids uuid[];
alter table public.studio_sample_links add column if not exists plays jsonb not null default '{}'::jsonb;
update public.studio_sample_links set sample_ids = array[sample_id] where sample_ids is null;

-- Counts one play of one clip on one link, atomically.
create or replace function public.studio_sample_play(p_link uuid, p_sample uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.studio_sample_links
     set plays = jsonb_set(plays, array[p_sample::text],
                           to_jsonb(coalesce((plays ->> p_sample::text)::int, 0) + 1), true)
   where id = p_link and p_sample = any(coalesce(sample_ids, array[sample_id]));
$$;
revoke all on function public.studio_sample_play(uuid, uuid) from public, anon, authenticated;
grant execute on function public.studio_sample_play(uuid, uuid) to service_role;
