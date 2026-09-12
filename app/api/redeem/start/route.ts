import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getActiveProviderId, getProvider } from "@/lib/providers";
import { isRateLimited } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

// Public endpoint — the visitor has no session yet, this is what kicks off
// a redeem attempt. Goes straight to the service-role client.

const REDEEM_TTL_MINUTES = 10;

// Lifetime for now (null). Set a number of days here to grant a
// time-limited key from redeem instead — kept as a single constant so it's
// easy to make this configurable (e.g. from settings) later.
const REDEEM_GRANT_DURATION_DAYS: number | null = null;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (isRateLimited(`redeem-start:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const adminClient = createAdminClient();

  const { data: settings } = await adminClient
    .from("settings")
    .select("providers, default_reset_limit")
    .eq("id", 1)
    .maybeSingle();

  const providerId = getActiveProviderId(
    settings?.providers as Record<string, { enabled?: boolean }> | undefined,
  );
  const provider = providerId ? getProvider(providerId) : null;

  if (!provider) {
    return NextResponse.json(
      { error: "No redeem provider is enabled." },
      { status: 503 },
    );
  }

  const { data: activeScripts } = await adminClient
    .from("scripts")
    .select("id")
    .eq("status", "active");

  const scriptIds = (activeScripts ?? []).map((row) => row.id as string);
  const hwidResetLimit = (settings?.default_reset_limit as number | undefined) ?? 3;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + REDEEM_TTL_MINUTES * 60_000).toISOString();

  const grants = {
    duration_days: REDEEM_GRANT_DURATION_DAYS,
    script_ids: scriptIds,
    hwid_reset_limit: hwidResetLimit,
  };

  // HWID isn't known yet — it binds automatically on the key's first
  // /api/v1/validate call, not during redeem.
  const { error } = await adminClient.from("redeem_sessions").insert({
    token,
    provider: providerId,
    hwid: null,
    ip,
    status: "pending",
    expires_at: expiresAt,
    grants,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL is not set" }, { status: 500 });
  }

  const destination = `${appUrl}/api/redeem/callback?token=${token}`;

  let link: string;
  try {
    link = provider.buildLink(token, destination);
  } catch (buildError) {
    const message =
      buildError instanceof Error ? buildError.message : "Provider misconfigured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, link });
}
