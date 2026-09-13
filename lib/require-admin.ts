import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;

type AdminSession = {
  userId: string;
  adminClient: AdminClient;
};

/** Logged in AND has a row in `admins`; null otherwise. */
async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createServerClient();

  // getClaims() verifies the JWT locally against the cached JWKS (no network
  // round-trip) now that the project uses asymmetric signing keys. Middleware
  // (proxy.ts) still runs getUser() to refresh/rotate tokens; here we only
  // need to trust the already-refreshed access token.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data: admin } = await adminClient
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!admin) {
    return null;
  }

  return { userId, adminClient };
}

type RequireAdminResult =
  | ({ authorized: true } & AdminSession)
  | { authorized: false; response: NextResponse };

/**
 * For Route Handlers. Verifies the caller is a logged-in Supabase user AND
 * has a row in `admins`. On success, returns the privileged service-role
 * client so the route can do the actual (RLS-bypassing) work.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await getAdminSession();

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true, ...session };
}

/**
 * For Server Components / layouts. Same check as `requireAdmin`, but
 * redirects to /login instead of returning a JSON 401. This is what
 * actually gates every page under /dashboard, since those pages read
 * through the service-role client and would otherwise leak admin data
 * (script content, keys, logs) to any logged-in non-admin user.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
