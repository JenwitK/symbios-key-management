-- Run in the Supabase SQL Editor (or `supabase db push`).
create or replace function execution_stats(from_ts timestamptz default null, to_ts timestamptz default null)
returns table(total_executions bigint, unique_devices bigint)
language sql stable as $$
  select
    count(*) filter (where result = 'ok'),
    count(distinct hwid) filter (where result = 'ok')
  from validation_logs
  where (from_ts is null or created_at >= from_ts)
    and (to_ts is null or created_at <= to_ts);
$$;
