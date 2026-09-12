This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Lua loader example

`POST /api/v1/validate` is the endpoint the in-game loader calls. It takes
`{ key, hwid, script_slug }` and returns `{ success: true, script }` or
`{ success: false, reason }` (`invalid_key` | `banned` | `paused` | `expired`
| `no_access` | `hwid_mismatch`).

```lua
local HttpService = game:GetService("HttpService")

local KEY = "SYMBIOS-XXXX-XXXX-XXXX" -- user pastes their key here
local HWID = game:GetService("RbxAnalyticsService"):GetClientId()

local response = request({
	Url = "https://symbios.app/api/v1/validate",
	Method = "POST",
	Headers = { ["Content-Type"] = "application/json" },
	Body = HttpService:JSONEncode({
		key = KEY,
		hwid = HWID,
		script_slug = "my-script",
	}),
})

local body = HttpService:JSONDecode(response.Body)

if body.success then
	loadstring(body.script)()
else
	warn("SYMBIOS: validation failed — " .. tostring(body.reason))
end
```

## Discord OAuth setup (for /panel)

`/panel` uses Supabase Auth's Discord provider — set it up once per environment:

1. **Discord Developer Portal** ([discord.com/developers/applications](https://discord.com/developers/applications)) → create/open an application → **OAuth2** → General:
   - Copy the **Client ID** and **Client Secret** into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` in `.env.local`.
   - Under **Redirects**, add your Supabase project's callback URL:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find the exact URL in the Supabase dashboard step below — Supabase shows it for you).
2. **Supabase Dashboard** → Authentication → Providers → **Discord** → enable it, paste the same Client ID/Secret, save.
3. In this app's own env, set `APP_URL` to your deployed origin (or `http://localhost:3000` locally) — the sign-in button redirects to `${APP_URL}/auth/callback`, which exchanges the OAuth code for a session and lands the user back on `/panel`.

No redirect URL needs to be registered on Discord's side for our own `/auth/callback` — Discord only ever redirects to Supabase's callback URL above; Supabase then redirects to ours.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. **Supabase**: make sure `supabase/migrations/0001_init.sql` has been applied to your production project (`supabase db push`, or paste it into the SQL Editor), and that at least one row exists in `admins` (see the note at the bottom of that migration file for how to create the first one).
2. **Push to Vercel** ([vercel.com/new](https://vercel.com/new)) and import this repo.
3. **Set every env var from `.env.example`** in the Vercel project's Settings → Environment Variables (Production):

   | Var | Production value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from your Supabase project's API settings |
   | `SUPABASE_SERVICE_ROLE_KEY` | same — **server-only**, never expose to the client |
   | `APP_URL` | your real production origin, e.g. `https://symbios.app` (used to build the redeem callback URL and the Discord sign-in redirect) |
   | `VALIDATE_SIGNING_SECRET` | a real random secret |
   | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | from the Discord app, see the OAuth section above |
   | `LINKVERTISE_SECRET` / `LINKVERTISE_USER_ID` | your real Linkvertise anti-bypass token and account id — the redeem flow silently can't build a working link without these |
   | `REDEEM_DEV_BYPASS` | **leave unset.** It's a local-only escape hatch already gated on `NODE_ENV !== "production"`, but don't set it in a production environment regardless |
   | `MOONVEIL_API_KEY` | only needed once auto-obfuscation (phase B) is wired up |

4. **Redeploy** after adding env vars (Vercel doesn't hot-reload them into a running deployment).
5. Update the Discord app's redirect and Supabase's Discord provider config if you're moving from a dev Supabase project to a production one — the callback URL is per-Supabase-project.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more general deployment details.
