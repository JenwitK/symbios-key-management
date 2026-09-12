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

  return { userId: user.id, discordId };
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
