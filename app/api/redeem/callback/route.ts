import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getProvider, verifyRedeem } from "@/lib/providers";
import { getClientIp } from "@/lib/request-ip";
import { generateKeyValue } from "@/lib/keys";

const UNIQUE_VIOLATION = "23505";
const MAX_GENERATE_ATTEMPTS = 5;

function redirectToGetKey(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/get-key", request.url);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const token = request.nextUrl.searchParams.get("token");
  const hash = request.nextUrl.searchParams.get("hash");

  if (!token || !hash) {
    return redirectToGetKey(request, { error: "missing_params" });
  }

  const adminClient = createAdminClient();

  const { data: session } = await adminClient
    .from("redeem_sessions")
    .select("id, provider, ip, status, expires_at, grants")
    .eq("token", token)
    .maybeSingle();

  if (!session) {
    return redirectToGetKey(request, { error: "invalid_session" });
  }

  if (session.status !== "pending") {
    return redirectToGetKey(request, { error: "session_used" });
  }

  if (new Date(session.expires_at as string).getTime() < Date.now()) {
    await adminClient
      .from("redeem_sessions")
      .update({ status: "expired" })
      .eq("id", session.id as string)
      .eq("status", "pending");
    return redirectToGetKey(request, { error: "session_expired" });
  }

  if (session.ip !== ip) {
    return redirectToGetKey(request, { error: "ip_mismatch" });
  }

  const provider = getProvider(session.provider as string);
  if (!provider) {
    return redirectToGetKey(request, { error: "no_provider" });
  }

  // Server-to-server only — never trust the client for this.
  let verification: { ok: boolean; meta?: Record<string, unknown> };
  try {
    verification = await verifyRedeem(provider, hash, ip ?? "");
  } catch {
    return redirectToGetKey(request, { error: "verification_failed" });
  }
  if (!verification.ok) {
    return redirectToGetKey(request, { error: "verification_failed" });
  }

  // Compare-and-swap: only proceed if we're the one flipping pending ->
  // completed. Guards against a duplicate/replayed callback hit issuing a
  // second key for the same session.
  const { data: claimed } = await adminClient
    .from("redeem_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", session.id as string)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return redirectToGetKey(request, { error: "session_used" });
  }

  const grants = session.grants as {
    duration_days: number | null;
    script_ids: string[];
    hwid_reset_limit: number;
  };

  const { data: settings } = await adminClient
    .from("settings")
    .select("key_prefix")
    .eq("id", 1)
    .maybeSingle();

  const prefix = (settings?.key_prefix as string | undefined) ?? "SYMBIOS";

  const expiresAt = grants.duration_days
    ? new Date(Date.now() + grants.duration_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  let key: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS && !key; attempt++) {
    const { data, error } = await adminClient
      .from("keys")
      .insert({
        key_value: generateKeyValue(prefix),
        // Not bound here — the key's first /api/v1/validate call binds hwid.
        hwid: null,
        hwid_reset_limit: grants.hwid_reset_limit,
        expires_at: expiresAt,
        status: "active",
      })
      .select()
      .single();

    if (data) {
      key = data;
    } else if (error?.code === UNIQUE_VIOLATION) {
      continue;
    } else if (error) {
      return redirectToGetKey(request, { error: "issue_failed" });
    }
  }

  if (!key) {
    return redirectToGetKey(request, { error: "issue_failed" });
  }

  if (grants.script_ids.length > 0) {
    await adminClient.from("key_scripts").insert(
      grants.script_ids.map((scriptId) => ({
        key_id: key!.id as string,
        script_id: scriptId,
      })),
    );
  }

  return redirectToGetKey(request, { key: key.key_value as string });
}
