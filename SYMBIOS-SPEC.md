# SYMBIOS — Technical Spec

> Lua Whitelist / Key System (single-owner). ตัวเว็บทำหน้าที่ **key system + whitelist + จัดส่งสคริปต์** ไม่ทำ obfuscation เอง (ใช้ MoonVeil แยกต่างหาก)

เอกสารนี้เป็นสเปกตั้งต้นก่อนเริ่มเขียนโค้ด — review แล้วแก้ตรงไหนได้เลย

---

## 1. ภาพรวม & positioning

**SYMBIOS** = บริการ Lua Whitelist แบบ single-owner: เจ้าของ (คุณ) คุม key ทั้งหมด, ผู้ใช้ปลายทางแค่รับ key ไปใช้ในสคริปต์ Roblox

การแบ่งหน้าที่ 2 ชั้น:

| ชั้น | ใครทำ | หน้าที่ |
|---|---|---|
| **Whitelist / auth** | SYMBIOS (เว็บนี้) | คุมว่า *ใคร* มีสิทธิ์โหลดสคริปต์ (key + HWID) |
| **Obfuscation** | MoonVeil (ภายนอก) | คุมว่า *โค้ดอ่านไม่ออก* |

Flow ระดับสูง:

```
Loader (public) ──key+hwid──► /api/v1/validate ──► Supabase (ตรวจ key/HWID)
                                     │
                            ผ่าน → ส่ง script (obf) กลับ → loadstring()()
```

---

## 2. Tech stack

- **Frontend/Backend:** Next.js (App Router) + TypeScript
- **Styling:** CSS Modules (ไม่ใช้ Tailwind) + design tokens ใน `globals.css`
- **Database/Auth:** Supabase (Postgres + Auth + RLS + Storage)
- **Deploy:** Vercel
- **Obfuscation:** MoonVeil (แบบ A — manual paste ก่อน, แบบ B — auto API ทีหลัง)

---

## 3. Roles & Auth

| Role | ใคร | Login | เข้าถึง |
|---|---|---|---|
| **Admin** | คุณ (เจ้าของ) | **username + password** | `/dashboard/*` — จัดการ key/script/logs/settings |
| **End user** | ลูกค้า | **Discord OAuth** | `/panel` — ดู key ตัวเอง, reset HWID |

**หมายเหตุ implementation:** Supabase Auth ใช้ email เป็นหลัก → ทำ username โดย map `username → email ภายใน` (เช่น เก็บใน `admins.username` แล้ว sign-in ด้วย email ที่ผูกไว้) Discord ใช้ผ่าน Supabase OAuth provider ได้ native

---

## 4. Data model (Postgres / Supabase)

```sql
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
```

---

## 5. RLS (Row-Level Security)

หลักการ: **default-deny ทุกตาราง** แล้ว operation ที่ sensitive วิ่งผ่าน Next.js server routes ด้วย `SERVICE_ROLE_KEY` (bypass RLS) — client ไม่ query ตารางพวกนี้ตรง ๆ

- `keys`, `scripts`, `redeem_*`, `validation_logs`, `settings` → **ไม่มี policy public เลย** (เข้าได้เฉพาะ service role ฝั่ง server)
- **User panel (Discord):** อ่าน key ของตัวเองผ่าน server route ที่ filter ด้วย session (`discord_id = ผู้ล็อกอิน`) — ปลอดภัยกว่าเปิด RLS ตรง ๆ
- **Admin dashboard:** ทุก mutation ผ่าน `/api/admin/*` ที่ตรวจ admin session ก่อน แล้วใช้ service role

---

## 6. Core flows

### 6.1 Validate (Lua ยิงเข้ามา)

```
POST /api/v1/validate   { key, hwid, script_slug }
  1. หา key → active? ยังไม่หมดอายุ? ไม่ถูกแบน?
  2. key เข้าถึง script_slug นี้ได้ไหม (key_scripts)
  3. hwid ว่าง → ผูก hwid | ตรง → ผ่าน | ไม่ตรง → reject
  4. log + update last_seen_at / last_ip
  5. ผ่าน → return { success:true, script: <obf content> }
     ไม่ผ่าน → return { success:false, reason }
```

Loader ฝั่ง Lua: `loadstring(resp.script)()` เฉพาะตอน success

### 6.2 Redeem / link monetization (กัน bypass)

```
1. /get-key → server สร้าง redeem_session (token, ผูก hwid+ip, TTL 10 นาที, pending)
2. ส่ง user ไป Linkvertise anti-bypass link (destination = /api/redeem/callback?hash={TOKEN})
3. user กดผ่านลิงก์จบ → Linkvertise redirect กลับมาพร้อม hash จริง
4. server verify hash แบบ server-to-server กับ Linkvertise + เช็ค ip/expiry/single-use
5. ผ่าน → mark completed → issue/activate key ให้ hwid นั้น
```

**อย่าเชื่อ destination URL — ต้อง verify hash ฝั่ง server เท่านั้น** (นี่คือจุดที่กัน bypass ได้จริง)
เนื่องจาก Linkvertise anti-bypass อ่อนกว่าเจ้าอื่น → ฝั่งเราต้องอัด layer เสริมให้แน่น: token single-use + TTL สั้น + ผูก HWID/IP + rate-limit

### 6.3 HWID reset

```
POST /api/panel/reset-hwid  (ต้องล็อกอิน Discord)
  - เช็ค hwid_resets < hwid_reset_limit
  - ผ่าน → set keys.hwid = null, hwid_resets += 1
```

### 6.4 อัปเดตสคริปต์ (แบบ A)

```
obf ใน MoonVeil เอง → copy output → paste ลง dashboard (scripts.content) → save → live ทันที
```
(แบบ B ทีหลัง: paste โค้ดดิบ → server เรียก MoonVeil /api/v2/obf → เก็บผลลัพธ์)

---

## 7. Routes / Pages

```
PUBLIC                         ADMIN (username/pw)          API
/                landing       /login                       POST /api/v1/validate      ← Lua
/get-key         redeem flow   /dashboard        overview   POST /api/redeem/start
/panel           user (Discord) /dashboard/keys             GET  /api/redeem/callback
                               /dashboard/scripts           POST /api/panel/reset-hwid
                               /dashboard/logs              /api/admin/keys      (CRUD)
                               /dashboard/settings          /api/admin/scripts   (CRUD)
                                                            /api/admin/settings
```

---

## 8. Provider — Linkvertise (เจ้าเดียว)

ใช้ **Linkvertise** อย่างเดียว (payout ดีกว่าเจ้าอื่นในโซนเป้าหมาย) แต่ยังเขียนเป็น adapter เดียว เผื่อเพิ่ม provider ภายหลังโดยไม่ต้องรื้อ:

```ts
interface LinkProvider {
  id: 'linkvertise'
  buildLink(token: string, destination: string): string
  verify(hash: string, ip: string): Promise<{ ok: boolean; meta?: any }>
}
```

| Provider | destination | verify (server-to-server) |
|---|---|---|
| Linkvertise | `/api/redeem/callback?hash={HASH}` | verify hash ด้วย Linkvertise secret (SHA) — ใช้ anti-bypass link ของ Linkvertise |

เปิด/ปิดใน `settings.providers`, secret อยู่ใน env (`LINKVERTISE_SECRET`, `LINKVERTISE_USER_ID`)

> Linkvertise anti-bypass เป็นแบบหน้าต่างเวลา fixed ซึ่งอ่อนกว่าเจ้าอื่น → ชั้นป้องกันหลักอยู่ที่ logic ฝั่งเรา (§6.2)

---

## 9. Design system (monochrome — ไม่ให้ดูเป็น AI)

```css
--bg:         #0A0A0B;   /* ดำเกือบสนิท + grid เส้นจาง */
--surface:    #141416;   /* การ์ด */
--surface-2:  #1C1C1F;
--border:     rgba(255,255,255,.08);
--text:       #FAFAFA;
--text-dim:   #8A8A8F;
--text-mute:  #5A5A5F;
--ok:   #3FB950;  --warn: #D29922;  --err: #F85149;  /* จุดสถานะเท่านั้น */
```

- **ฟอนต์:** display = geometric sans ตัวหนา (Space Grotesk / Satoshi), body = สาย Inter แต่เลือกตัวมีคาแรกเตอร์, **mono = ลายเซ็น** (JetBrains/Geist Mono) ใช้กับ key/ตัวเลข/label
- **หลักกัน "AI look":** มุมคมแบบ editorial, asymmetry ไม่ center ทุกอย่าง, texture/grain บาง ๆ, hairline, copy เจาะจงจริงไม่ใช่คำสวยลอย ๆ
- อ้างอิงโทนจาก reference: การ์ดขอบ 1px, code block จุด mac 3 สี, pill badge มีจุดนำหน้า, wordmark two-tone

---

## 10. Env vars ที่ต้องเตรียม

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only

# App
APP_URL=https://symbios...
VALIDATE_SIGNING_SECRET=          # เซ็น response ตรวจ key

# Discord OAuth (ผ่าน Supabase)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Linkvertise (link monetization)
LINKVERTISE_SECRET=
LINKVERTISE_USER_ID=

# MoonVeil (เฉพาะแบบ B ทีหลัง)
MOONVEIL_API_KEY=
```

---

## 11. Roadmap (เฟส)

1. **Foundation** — Next.js TS + CSS Module tokens + Supabase schema/RLS + env
2. **Landing page** — ล็อกโทนให้ผ่านตาก่อน ⭐
3. **Admin auth + dashboard shell** (username/pw)
4. **Scripts management** — paste obf, CRUD, versioning
5. **Keys CRUD** — สร้าง/แบน/reset HWID/ตั้งวันหมดอายุ
6. **Validation API** — endpoint Lua + จัดส่ง script + logs
7. **Redeem / anti-bypass** — Linkvertise + `/get-key`
8. **User panel (Discord)** — ดู key + reset HWID เอง
9. **Analytics/logs UI + polish + deploy Vercel**

---

## 12. สิ่งที่คุณต้องเตรียม (ตอนถึงเฟสนั้น ๆ)

- [ ] Supabase project (URL + anon key + service role key)
- [ ] Discord application (OAuth client id/secret) — เฟส 8
- [ ] บัญชี Linkvertise + secret / user id (เปิด anti-bypass link) — เฟส 7
- [ ] MoonVeil API key — เฉพาะถ้าจะทำแบบ B
- [ ] โดเมน (เช่น symbios.xxx) สำหรับ deploy

---

*แก้/เพิ่มตรงไหนบอกได้เลย พอ ok ผมเริ่มเฟส 1 (scaffold) + เฟส 2 (landing) ให้เห็นโทนก่อน*
