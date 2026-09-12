-- Run in the Supabase SQL Editor (or `supabase db push`).
create or replace function top_scripts(from_ts timestamptz default null, to_ts timestamptz default null, lim int default 10)
returns table(script_id uuid, name text, slug text, executions bigint)
language sql stable as $$
  select vl.script_id, s.name, s.slug, count(*) as executions
  from validation_logs vl
  join scripts s on s.id = vl.script_id
  where vl.result = 'ok' and vl.script_id is not null
    and (from_ts is null or vl.created_at >= from_ts)
    and (to_ts is null or vl.created_at <= to_ts)
  group by vl.script_id, s.name, s.slug
  order by executions desc
  limit lim;
$$;
