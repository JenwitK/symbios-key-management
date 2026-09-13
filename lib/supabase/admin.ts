import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged client: bypasses RLS via the service role key.
 * Server-only: never import this into a client component.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
