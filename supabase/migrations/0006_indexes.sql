-- SYMBIOS — performance indexes
-- Run in the Supabase SQL Editor (or `supabase db push`).
-- No schema change; safe to run once. Uses IF NOT EXISTS so re-running is a no-op.

-- validation_logs is the hot, ever-growing table. Every dashboard read filters
-- or sorts by these columns; without indexes each query scans the whole table.

-- Logs page: ORDER BY created_at DESC (+ the exact-count pagination).
create index if not exists idx_vlogs_created_at
  on validation_logs (created_at desc);

-- Logs page result filter + range, and overview "hwid mismatches (24h)".
create index if not exists idx_vlogs_result_created_at
  on validation_logs (result, created_at desc);

-- top_scripts(): groups ok rows by script_id. Partial index keeps it tiny.
create index if not exists idx_vlogs_ok_script
  on validation_logs (script_id)
  where result = 'ok';

-- Embedded join validation_logs -> keys on the logs table.
create index if not exists idx_vlogs_key_id
  on validation_logs (key_id);

-- Overview "active keys" count.
create index if not exists idx_keys_status
  on keys (status);

-- Panel: keys lookup by the signed-in Discord user.
create index if not exists idx_keys_discord_id
  on keys (discord_id)
  where discord_id is not null;

-- key_scripts is read whole on the keys page; add the reverse-lookup index
-- (the PK already covers key_id-first lookups).
create index if not exists idx_key_scripts_script_id
  on key_scripts (script_id);
