# PROMPTS.md — คำสั่งพร้อม paste เข้า Claude Code (ทีละเฟส)

> วิธีใช้: เปิดโปรเจกต์ใน VSCode ที่มี `SPEC.md` + `CLAUDE.md` อยู่ root แล้ว paste prompt ทีละเฟส
> **อย่า paste หลายเฟสรวด** — ทำให้เสร็จ ทดสอบ แล้วค่อยไปเฟสถัดไป
> ทุก prompt ให้ Claude Code อ่าน `SPEC.md` + `CLAUDE.md` ก่อนเสมอ

---

## เฟส 0 — เริ่มต้น (paste ครั้งเดียวตอนเปิดโปรเจกต์)

```
อ่าน SPEC.md และ CLAUDE.md ให้ครบก่อน แล้วสรุปกลับมาให้ฉันสั้น ๆ ว่า:
โปรเจกต์นี้คืออะไร, stack ที่ต้องใช้, และ 9 เฟสมีอะไรบ้าง
ยังไม่ต้องเขียนโค้ดใด ๆ — แค่ยืนยันว่าเข้าใจตรงกัน
```

---

## เฟส 1 — Foundation

```
เริ่มเฟส 1 เท่านั้น (Foundation) ตาม SPEC.md:
- scaffold Next.js App Router + TypeScript (strict) + CSS Modules (ห้าม Tailwind)
- ตั้งโครง folder ตาม CLAUDE.md
- สร้าง app/globals.css พร้อม design tokens โทน monochrome ตาม SPEC §9 (สี, ฟอนต์ mono เป็น signature, grid texture)
- ตั้ง Supabase client 2 ตัว: browser (anon) + server (service role) ใน lib/supabase/
- สร้าง supabase/migrations/0001_init.sql จาก schema ใน SPEC §4 พร้อมเปิด RLS default-deny ตาม SPEC §5
- สร้าง .env.example (มี key ครบ ไม่มี value) และ .gitignore
ห้ามทำเฟสอื่น พอเสร็จบอกวิธีรัน dev + วิธี apply migration
```

---

## เฟส 2 — Landing page (สำคัญ: ล็อกโทน)

```
เริ่มเฟส 2 เท่านั้น: landing page ที่ path "/"
โทนต้องตาม CLAUDE.md (monochrome ดำเทา, mono font เป็น signature, มุมคม editorial, grid texture, ไม่ให้ดูเป็น AI)
โครง section:
- navbar: wordmark two-tone "SYMBIOS" + เมนู + ปุ่ม Get Key
- hero: หัวข้อหนัก ๆ + subtitle + code block ตัวอย่าง loader (จุด mac 3 สี + ปุ่ม Copy)
- features: จุดเด่นของ key system (whitelist, HWID lock, anti-bypass) — อย่าทำเป็นการ์ด 3 ใบเหมือนกันเป๊ะ
- footer
ใช้ CSS Modules ต่อ component, ดึงสีจาก tokens ห้าม hardcode
พอเสร็จให้ screenshot หรือบอกให้ฉันเปิด localhost ดู แล้วรอฉันคอนเฟิร์มโทนก่อนไปต่อ
```

---

## เฟส 3 — Admin auth + dashboard shell

```
เริ่มเฟส 3 เท่านั้น: admin auth + โครง dashboard
- /login ด้วย username + password (map username → email ภายในตาม SPEC §3)
- ป้องกันทุก route ใต้ /dashboard ด้วย admin session (middleware)
- โครง dashboard shell: sidebar (Keys, Scripts, Logs, Settings) + topbar + หน้า overview ว่าง ๆ
- ตาราง admins ผูกกับ auth.users
ยังไม่ต้องทำ CRUD จริง แค่ shell + auth ที่ใช้งานได้
ห้ามทำเฟสอื่น
```

---

## เฟส 4 — Scripts management

```
เริ่มเฟส 4 เท่านั้น: จัดการสคริปต์ที่ /dashboard/scripts
- CRUD สคริปต์: name, slug, content (paste โค้ดที่ obf จาก MoonVeil แล้ว — แบบ A), status, version
- ทุก mutation ผ่าน /api/admin/scripts (service role, ตรวจ admin session)
- แสดงขนาด content + วันที่อัปเดต
- เผื่อ field source_content + obf_config ไว้ (แบบ B) แต่ยังไม่ต้องต่อ MoonVeil API
validate input ด้วย zod
ห้ามทำเฟสอื่น
```

---

## เฟส 5 — Keys CRUD

```
เริ่มเฟส 5 เท่านั้น: จัดการ key ที่ /dashboard/keys
- สร้าง key (gen รูปแบบ SYMBIOS-XXXX-XXXX-XXXX ตาม settings.key_prefix)
- ตั้ง label, expires_at (null = lifetime), hwid_reset_limit, ผูก key_scripts (เลือกว่าเข้า script ไหนได้)
- action: ban/pause/activate, reset HWID (set hwid=null, ไม่กิน quota เพราะ admin ทำเอง)
- ตาราง list + filter ตาม status, แสดง hwid / last_seen / resets
- ทุก mutation ผ่าน /api/admin/keys (service role + zod)
ห้ามทำเฟสอื่น
```

---

## เฟส 6 — Validation API (endpoint ที่ Lua ยิงเข้า)

```
เริ่มเฟส 6 เท่านั้น: POST /api/v1/validate ตาม SPEC §6.1
- รับ { key, hwid, script_slug }
- ตรวจ: key active + ไม่หมดอายุ + ไม่ถูกแบน + เข้าถึง script_slug ได้ (key_scripts)
- HWID: ว่าง→ผูก / ตรง→ผ่าน / ไม่ตรง→reject
- ผ่าน → return { success:true, script: <scripts.content> }; ไม่ผ่าน → { success:false, reason }
- log ทุกครั้งลง validation_logs + update keys.last_seen_at/last_ip
- rate-limit endpoint นี้
- เขียนตัวอย่าง Lua loader สั้น ๆ ไว้ใน README ว่าเรียก endpoint นี้ยังไง
ห้ามทำเฟสอื่น
```

---

## เฟส 7 — Redeem / anti-bypass (Linkvertise)

```
เริ่มเฟส 7 เท่านั้น: link monetization กัน bypass ตาม SPEC §6.2 + §8
- ใช้ Linkvertise เจ้าเดียว แต่เขียนเป็น provider adapter interface (lib/providers/) เผื่อเพิ่มภายหลัง
- POST /api/redeem/start: สร้าง redeem_session (token, ผูก hwid+ip, TTL 10 นาที, pending) + คืน Linkvertise anti-bypass link
- GET /api/redeem/callback: verify hash แบบ server-to-server กับ Linkvertise (secret) + เช็ค ip/expiry/single-use → ผ่านแล้ว issue/activate key
- หน้า /get-key: ปุ่มเดียวไป Linkvertise (อ่านจาก settings.providers)
- ห้ามเชื่อ destination URL / client flag เด็ดขาด — Linkvertise anti-bypass อ่อน ต้องอัด layer ฝั่งเราให้แน่น
- อ่าน LINKVERTISE_SECRET / LINKVERTISE_USER_ID จาก env เท่านั้น
ห้ามทำเฟสอื่น
```

---

## เฟส 8 — User panel (Discord)

```
เริ่มเฟส 8 เท่านั้น: user panel ที่ /panel
- login ด้วย Discord OAuth ผ่าน Supabase
- แสดง key ของตัวเอง (filter ด้วย discord_id ผ่าน server route — ไม่เปิด RLS ตรง)
- ปุ่ม reset HWID เอง: POST /api/panel/reset-hwid เช็ค hwid_resets < limit แล้ว set hwid=null, resets+=1
- แสดงสถานะ key, วันหมดอายุ, resets ที่เหลือ
ห้ามทำเฟสอื่น
```

---

## เฟส 9 — Analytics + polish + deploy

```
เริ่มเฟส 9: หน้า logs/analytics + polish + deploy
- /dashboard/logs: ตาราง validation_logs + filter (result, ช่วงเวลา) + สรุปตัวเลข (validations วันนี้, active keys, HWID mismatch)
- /dashboard/settings: แก้ key_prefix, default_reset_limit, เปิด/ปิด providers
- ตรวจ responsive ทุกหน้า (มือถือ ~400px), เก็บ edge cases
- เตรียม deploy Vercel: ตรวจ env, build ผ่าน, เขียน README วิธี deploy
```

---

## เคล็ดลับตอนสั่ง

- ถ้า Claude Code เริ่มหลุดโทน/ใส่ Tailwind/ทำข้ามเฟส → เตือน: **"ยึด CLAUDE.md — ทำเฉพาะเฟสนี้ ใช้ CSS Modules เท่านั้น"**
- อยากแก้ดีไซน์ให้ตรงขึ้น → ส่ง screenshot reference ให้มันดู แล้วบอกจุดที่ต่าง
- ก่อนไปเฟสถัดไป ให้มัน `tsc --noEmit` + `npm run build` ผ่านก่อนเสมอ
