# Discord OAuth Setup — SYMBIOS Panel

คู่มือเปิดใช้ปุ่ม **"Sign in with Discord"** ที่หน้า `/panel` เพื่อให้ end-user ล็อกอินมาดู key + reset HWID ของตัวเองได้

---

## Flow ทำงานยังไง (เข้าใจก่อน redirect URL จะได้ไม่งง)

```
เว็บเรา (/panel)
   └─► Supabase ──► Discord (ขออนุญาต)
                      └─► Supabase (/auth/v1/callback)
                            └─► เว็บเรา (/auth/callback?code=...) ──► แลก session ──► /panel (ล็อกอินแล้ว)
```

มี redirect URL **2 ที่** ที่ต้องตั้งให้ตรง (Step 2 กับ Step 4) — ถ้าพลาดตรงนี้คือสาเหตุ error 90%

---

## Step 1 — สร้าง Discord Application

1. เข้า https://discord.com/developers/applications
2. กด **New Application** → ตั้งชื่อ (เช่น `SYMBIOS`) → Create
3. เมนูซ้าย → **OAuth2**
4. คัดลอกไว้ 2 ค่า:
   - **Client ID**
   - **Client Secret** (กด **Reset Secret** เพื่อดู แล้วเก็บให้ดี — ห้ามหลุด)

---

## Step 2 — ใส่ Redirect URI ใน Discord

ยังอยู่หน้า **OAuth2** → หัวข้อ **Redirects** → **Add Redirect** → ใส่ URL ของ Supabase:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

- `<your-project-ref>` = ตัวหน้าสุดของ Project URL (ดูได้ที่ Supabase → **Project Settings → API → Project URL**)
- เช่น ถ้า Project URL คือ `https://abcd1234.supabase.co` → ใส่ `https://abcd1234.supabase.co/auth/v1/callback`

กด **Save Changes**

> ⚠️ ตรงนี้ต้องเป็น URL ของ **Supabase** (ลงท้าย `/auth/v1/callback`) ไม่ใช่ URL เว็บเรา — เป็นที่คนพลาดบ่อยสุด

---

## Step 3 — เปิด Discord provider ใน Supabase

1. Supabase dashboard → **Authentication → Providers → Discord**
2. เปิด toggle **Enable Sign in with Discord**
3. วาง **Client ID** + **Client Secret** จาก Step 1
4. **Save**

> หมายเหตุ: Client ID/Secret อยู่ใน **Supabase** ไม่ใช่ใน `.env` ของเว็บเรา — Supabase เป็นคนจัดการ OAuth handshake ให้ ตัวแปร `DISCORD_CLIENT_ID/SECRET` ใน `.env.example` เลย **ไม่จำเป็นต้องใส่** ถ้าใช้ provider ของ Supabase (ลบทิ้งหรือปล่อยว่างได้)

---

## Step 4 — ตั้ง Redirect URLs ใน Supabase

Supabase → **Authentication → URL Configuration**:

- **Site URL:**
  ```
  http://localhost:3000
  ```
  (ตอน deploy จริงค่อยเปลี่ยนเป็นโดเมน production)

- **Redirect URLs** → **Add URL:**
  ```
  http://localhost:3000/auth/callback
  ```
  (ตอน deploy เพิ่มของ production ด้วย เช่น `https://symbios.xxx/auth/callback`)

กด **Save**

---

## Step 5 — ทดสอบ

1. รีสตาร์ท `npm run dev` (ถ้าเพิ่งแก้ env)
2. เปิด http://localhost:3000/panel → กด **Sign in with Discord**
3. กด Authorize บนหน้า Discord → ต้องเด้งกลับมา `/panel` แบบล็อกอินแล้ว
4. ลอง **Link a key** — กรอก key `SYMBIOS-XXXX-XXXX-XXXX` (สร้างจาก dashboard หรือ redeem) → ต้องขึ้นในตาราง
5. ลองปุ่ม **Reset HWID** → resets left ต้องลดลง 1

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| Discord ขึ้น `redirect_uri_mismatch` | URL ใน Step 2 ไม่ตรงกับ callback ของ Supabase — ต้องเป็น `https://<ref>.supabase.co/auth/v1/callback` เป๊ะ |
| เด้งกลับ `/panel` แต่ไม่ล็อกอิน | Redirect URLs ใน Supabase (Step 4) ยังไม่มี `http://localhost:3000/auth/callback` |
| ล็อกอินได้แต่ panel บอก unauthorized / ไม่เห็น key | Discord identity ไม่มี `provider_id` — เช็คที่ Supabase → Authentication → Users → user ตัวเอง → ดู raw identity data ว่ามี provider = discord ไหม |
| กด Sign in แล้วไม่มีอะไรเกิด | ยังไม่ได้ Enable Discord provider ใน Supabase (Step 3) |

---

## หลังตั้งเสร็จ

บอกผมได้เลย เดี๋ยวผมช่วยเทสต์ full flow: login Discord → link key → reset HWID (เช็คว่า ownership + atomic quota ทำงานจริง) แล้วไปเฟส 9 (logs/analytics + deploy) ต่อ
