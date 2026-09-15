import { createBrowserClient } from "@supabase/ssr";

const cookieOptions = {
  maxAge: 60 * 60 * 24 * 400, // 400 days, matches refresh-token lifetime
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions },
  );
}
