import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const cookieOptions = {
  maxAge: 60 * 60 * 24 * 400, // 400 days, matches refresh-token lifetime
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are refreshed by
            // middleware instead, so writes here can be safely ignored.
          }
        },
      },
    },
  );
}
