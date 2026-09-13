import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type UserSession = {
  userId: string;
  discordId: string;
};

/**
 * Discord OAuth identity data isn't strongly typed by supabase-js (it's
 * `Record<string, any>`, provider-specific) — check the couple of field
 * names Supabase/Discord actually populate rather than trusting one shape.
 */
function extractDiscordId(user: User): string | null {
  const fromMetadata =
    user.user_metadata?.provider_id ?? user.user_metadata?.sub;
  if (typeof fromMetadata === "string" && fromMetadata) {
    return fromMetadata;
  }

  const discordIdentity = user.identities?.find(
    (identity) => identity.provider === "discord",
  );
  const fromIdentity =
    discordIdentity?.identity_data?.provider_id ??
    discordIdentity?.identity_data?.id ??
    discordIdentity?.identity_data?.sub;

  return typeof fromIdentity === "string" && fromIdentity ? fromIdentity : null;
}

/** Logged in AND has a Discord identity — null otherwise. */
export async function getUserSession(): Promise<UserSession | null> {
  const supabase = await createServerClient();

  // Local JWT verification (no network) — see lib/require-admin.ts.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return null;
  }

  const userId = claims.sub;

  // The JWT payload carries user_metadata but NOT the full identities array,
  // so read the Discord id from metadata first.
  const metadata = claims.user_metadata as
    | { provider_id?: unknown; sub?: unknown }
    | undefined;
  const fromMetadata =
    (typeof metadata?.provider_id === "string" && metadata.provider_id) ||
    (typeof metadata?.sub === "string" && metadata.sub) ||
    null;

  if (fromMetadata) {
    return { userId, discordId: fromMetadata };
  }

  // Fall back to one network getUser() only when the token didn't carry the
  // Discord id, so no buyer whose id lives only in identities gets locked out.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const discordId = extractDiscordId(user);
  if (!discordId) {
    return null;
  }

  return { userId, discordId };
}

type RequireUserResult =
  | ({ authorized: true } & UserSession)
  | { authorized: false; response: NextResponse };

/** For Route Handlers under /api/panel/*. */
export async function requireUser(): Promise<RequireUserResult> {
  const session = await getUserSession();

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true, ...session };
}
