# CLAUDE.md — SYMBIOS project rules

> อ่าน `SPEC.md` ก่อนเสมอ นั่นคือแหล่งความจริงของ data model, flows, และ roadmap
> ไฟล์นี้คือ "กติกา" ที่ห้ามฝ่าฝืน ทำงานทีละเฟสตาม `PROMPTS.md` — อย่าทำข้ามเฟส

---

## Output style — TERSE (save tokens)

This project is directed by a separate tech-lead session; a human relays the instructions. Token budget is shared, so **do the work — don't narrate it.**

- ❌ No preamble ("I'll now...", "Let me..."), no postamble, no restating the request, no line-by-line explanation of code you wrote.
- ❌ Don't add README files, extra comments, or docs unless explicitly asked.
- ✅ After finishing, reply with ONLY:
  1. files changed — a short bullet list (path + ≤6-word note each)
  2. commands to run/test (e.g. `npx tsc --noEmit`, `npm run build`, `npm run dev`)
  3. any blocker or question — one short sentence
- If a request is ambiguous or blocked, ask in a single sentence and stop. Don't guess.
- Just build. The tech lead reviews the actual files, not your explanation.

---

## What this project is

SYMBIOS — a **single-owner Lua Whitelist / Key System** for Roblox scripts.
The web app does: key + HWID whitelist, script delivery, link-monetization redeem (anti-bypass), admin dashboard, user panel. It does **NOT** do obfuscation (MoonVeil handles that externally; we only store & deliver the already-obfuscated blob).

---

## Tech stack — non-negotiable

- **Next.js (App Router)** + **TypeScript (strict)**
- **CSS Modules only.** `*.module.css` per component + design tokens in `app/globals.css`.
  - ❌ NO Tailwind. NO styled-components / emotion / any CSS-in-JS. NO UI kits (MUI, Chakra, shadcn).
  - ✅ Plain CSS + CSS variables + CSS Modules.
- **Supabase** (Postgres + Auth + RLS + Storage) via `@supabase/supabase-js` + `@supabase/ssr`.
- **Deploy target:** Vercel.
- Icons: inline SVG or a single lightweight icon set (e.g. `lucide-react`). No heavy component libraries.

---

## Folder structure

```
app/
  (public)/            # landing, get-key, panel
    page.tsx           # landing
    get-key/
    panel/
  (admin)/
    login/
    dashboard/
      page.tsx
      keys/
      scripts/
      logs/
      settings/
  api/
    v1/validate/route.ts
    redeem/start/route.ts
    redeem/callback/route.ts
    panel/reset-hwid/route.ts
    admin/**/route.ts
  globals.css          # design tokens live here
components/            # shared UI (Button, Card, Badge, CodeBlock, ...)
lib/
  supabase/            # server + browser clients
  providers/           # link-provider adapter (linkvertise only for now)
  keys.ts              # key gen / validation helpers
  hwid.ts
types/
supabase/
  migrations/          # schema.sql lives here
```

---

## Styling rules (this is where "not AI-made" is won or lost)

- All colors/fonts/spacing come from **CSS variables** defined once in `globals.css`. Never hardcode hex in a component.
- **Monochrome palette** (see SPEC §9). Color is used ONLY for status dots (ok/warn/err). Everything else is black/gray/white.
- **Mono font is the signature** — use it for keys, numbers, IDs, labels, code. Import: JetBrains Mono or Geist Mono.
- Prefer **sharp / editorial** details: hairline borders (`1px solid var(--border)`), tight type scale, intentional asymmetry. Avoid the generic "3 identical centered cards with round icons" layout.
- Add subtle texture (faint grid/noise) on dark backgrounds — no flat pure `#000`.
- ❌ Avoid AI-tells: heavy border-radius everywhere, purple/blue gradients, glassmorphism overload, emoji in headings, perfectly symmetric everything, filler copy like "Powerful. Secure. Fast."
- Write specific, real copy.

---

## TypeScript rules

- `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
- Shared types in `types/`. Generate Supabase types (`supabase gen types typescript`) into `types/database.ts`.
- Validate all external input (API route bodies) with `zod`.

---

## Supabase & security rules

- **Two clients:** browser client (anon key, public) and server client (service role, server-only). NEVER import the service-role client into a client component.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose to the browser. Never log it.
- **RLS default-deny.** Sensitive tables (`keys`, `scripts`, `redeem_*`, `validation_logs`, `settings`) have NO public policies. All access goes through server route handlers using the service role.
- **Script content (`scripts.content`) must never be reachable publicly** — only returned by `/api/v1/validate` after a passing check.
- **Anti-bypass:** redeem verification MUST be server-to-server against the provider. Never trust the destination URL / client-supplied "completed" flag. Tokens are single-use + short TTL + bound to HWID+IP.
- Rate-limit `/api/v1/validate` and `/api/redeem/*`.

---

## Secrets

- All secrets in `.env.local` (git-ignored). Provide `.env.example` with keys but NO values.
- Never commit real keys. Never paste keys into source or docs.

---

## API conventions

- Route handlers return JSON `{ success: boolean, ... }` or `{ error: string }` with correct HTTP status.
- `/api/v1/validate` is the Lua-facing endpoint — keep its response shape stable and documented.
- Log every validation attempt into `validation_logs`.

---

## Working style

- **One phase at a time** (see `PROMPTS.md`). Finish, let the human verify, then continue.
- Don't over-engineer. No premature abstractions beyond the provider adapter.
- After each phase: summarize what changed + how to run/test it.
- Keep commits small and scoped. Conventional-commit style messages.
- If a decision isn't covered by SPEC.md or this file, ask before guessing.

---

## Definition of done (per feature)

- Type-checks (`tsc --noEmit`) and builds clean.
- No secrets committed; `.env.example` updated if new env added.
- Sensitive data only reachable via server routes.
- Matches the design tokens (no hardcoded styles, no Tailwind).
