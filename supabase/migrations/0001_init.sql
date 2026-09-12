-- SYMBIOS — initial schema (SPEC.md §4)
-- All tables are RLS default-deny (SPEC.md §5): no public policies are created,
-- so the only way in is the service-role client (lib/supabase/admin.ts) from
-- trusted server routes, or narrowly-scoped policies added in later phases.

create extension if not exists "pgcrypto";

-- ผู้ดูแล (ผูกกับ Supabase auth.users)
create table admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  created_at timestamptz default now()
);

-- สคริปต์ (เก็บโค้ดที่ obf แล้ว)
create table scripts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,
  content        text,            -- โค้ดที่ obf แล้ว (ตัวที่ส่งจริง)  [แบบ A: paste ตรงนี้]
  source_content text,            -- โค้ดดิบ (optional, เผื่อ auto-obf แบบ B)
  obf_config     jsonb,           -- config ส่งให้ MoonVeil (cff/vm/safeEnv) [แบบ B]
  version        int default 1,
  status         text default 'active',   -- active | disabled
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- คีย์
create table keys (
  id               uuid primary key default gen_random_uuid(),
  key_value        text unique not null,     -- SYMBIOS-XXXX-XXXX-XXXX
  label            text,                     -- โน้ตว่าเป็นของใคร
  status           text default 'active',    -- active | paused | banned | expired
  hwid             text,                     -- ผูกตอนใช้ครั้งแรก (null = ยังไม่ผูก)
  hwid_resets      int  default 0,
  hwid_reset_limit int  default 3,
  expires_at       timestamptz,              -- null = lifetime
  discord_id       text,                     -- ผูกกับ user panel (optional)
  last_seen_at     timestamptz,
  last_ip          text,
  created_at       timestamptz default now()
);

-- key เข้าถึง script ไหนได้บ้าง (many-to-many, เผื่อ multi-script hub)
create table key_scripts (
  key_id    uuid references keys(id) on delete cascade,
  script_id uuid references scripts(id) on delete cascade,
  primary key (key_id, script_id)
);

-- session สำหรับ redeem/link (กัน bypass)
create table redeem_sessions (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null,
  provider     text not null default 'linkvertise',  -- ตอนนี้ใช้ linkvertise เจ้าเดียว (เผื่อเพิ่มภายหลัง)
  hwid         text,
  ip           text,
  status       text default 'pending',      -- pending | completed | expired
  grants       jsonb,                        -- ให้สิทธิ์อะไร (duration, script ids)
  expires_at   timestamptz not null,         -- TTL สั้น ~10 นาที
  completed_at timestamptz,
  created_at   timestamptz default now()
);

-- โค้ดแลก key แบบ manual (optional)
create table redeem_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  duration_days    int,                      -- null = lifetime
  hwid_reset_limit int default 3,
  script_ids       uuid[],
  used_by          text,
  used_at          timestamptz,
  created_at       timestamptz default now()
);

-- log ทุกครั้งที่ script ยิงเข้ามา
create table validation_logs (
  id         bigint generated always as identity primary key,
  key_id     uuid references keys(id) on delete set null,
  script_id  uuid references scripts(id) on delete set null,
  hwid       text,
  ip         text,
  result     text,                           -- ok | invalid_key | hwid_mismatch | expired | banned
  created_at timestamptz default now()
);

-- ตั้งค่ารวม (singleton row id=1)
create table settings (
  id                  int primary key default 1,
  key_prefix          text default 'SYMBIOS',
  default_reset_limit int default 3,
  providers           jsonb default '{"linkvertise":{"enabled":true}}',
  updated_at          timestamptz default now()
);

insert into settings (id) values (1);

-- RLS: default-deny on every table — no policies are created, so only the
-- service-role client (bypasses RLS) can read/write. Narrow, purpose-built
-- policies (e.g. user panel reading its own key) are added in later phases.
alter table admins           enable row level security;
alter table scripts          enable row level security;
alter table keys             enable row level security;
alter table key_scripts      enable row level security;
alter table redeem_sessions  enable row level security;
alter table redeem_codes     enable row level security;
alter table validation_logs  enable row level security;
alter table settings         enable row level security;

-- Creating the first admin (SPEC.md §3 — username/password login maps to an
-- internal auth.users email):
--   1. Supabase Dashboard → Authentication → Add user → set an email +
--      password for yourself (the email is internal, never shown to users).
--   2. SQL Editor → run:
--        insert into admins (id, username)
--        values ('<auth.users.id from step 1>', '<desired-username>');
-- Repeat for any additional admins. There is no self-serve admin signup.
