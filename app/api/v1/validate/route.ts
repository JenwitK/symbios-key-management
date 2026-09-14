import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

// Public, Lua-facing endpoint with no session, so it goes straight to the
// service-role client. Do NOT put requireAdmin() on this route.

const validateSchema = z.object({
  key: z.string().trim().min(1).max(64).optional(),
  hwid: z.string().trim().min(1).max(128),
  script_slug: z.string().trim().min(1).max(200),
});

async function withRetry<T>(
  run: () => PromiseLike<{ data: T; error: unknown }>,
  tries = 3,
): Promise<{ data: T; error: unknown }> {
  let result = await run();
  for (let i = 1; i < tries && result.error; i++) {
    await new Promise((r) => setTimeout(r, 60 * i)); // 60ms, then 120ms
    result = await run();
  }
  return result;
}

type ValidateReason =
  | "invalid_key"
  | "banned"
  | "paused"
  | "expired"
  | "no_access"
  | "hwid_mismatch"
  | "key_required"
  | "server_error"
  | "unknown_script";

async function logAttempt(
  adminClient: ReturnType<typeof createAdminClient>,
  entry: {
    keyId: string | null;
    scriptId: string | null;
    scriptSlug: string;
    hwid: string;
    ip: string | null;
    result: ValidateReason | "ok";
  },
) {
  await adminClient.from("validation_logs").insert({
    key_id: entry.keyId,
    script_id: entry.scriptId,
    script_slug: entry.scriptSlug,
    hwid: entry.hwid,
    ip: entry.ip,
    result: entry.result,
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (isRateLimited(`validate:${ip ?? "unknown"}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const adminClient = createAdminClient();

  const { data: settingsRow } = await adminClient
    .from("settings")
    .select("maintenance")
    .eq("id", 1)
    .maybeSingle();

  if (settingsRow?.maintenance) {
    // No log entry here on purpose: a maintenance window would otherwise
    // flood validation_logs with one row per loader call for its duration.
    return NextResponse.json(
      { success: false, reason: "maintenance" },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = validateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { key: keyValue, hwid, script_slug: scriptSlug } = parsed.data;

  const { data: scriptRow, error: scriptErr } = await withRetry(() =>
    adminClient
      .from("scripts")
      .select("id, content, keyless")
      .eq("slug", scriptSlug)
      .maybeSingle(),
  );

  if (scriptErr) {
    await logAttempt(adminClient, {
      keyId: null,
      scriptId: null,
      scriptSlug,
      hwid,
      ip,
      result: "server_error",
    });
    return NextResponse.json(
      { success: false, reason: "server_error" },
      { status: 503 },
    );
  }

  if (scriptRow?.keyless === true) {
    if (typeof scriptRow.content !== "string" || scriptRow.content.length === 0) {
      await logAttempt(adminClient, {
        keyId: null,
        scriptId: scriptRow.id as string,
        scriptSlug,
        hwid,
        ip,
        result: "server_error",
      });
      return NextResponse.json(
        { success: false, reason: "server_error" },
        { status: 500 },
      );
    }

    await logAttempt(adminClient, {
      keyId: null,
      scriptId: scriptRow.id as string,
      scriptSlug,
      hwid,
      ip,
      result: "ok",
    });
    return NextResponse.json({ success: true, script: scriptRow.content });
  }

  if (!scriptRow) {
    await logAttempt(adminClient, {
      keyId: null,
      scriptId: null,
      scriptSlug,
      hwid,
      ip,
      result: "unknown_script",
    });
    return NextResponse.json(
      { success: false, reason: "unknown_script" },
      { status: 404 },
    );
  }

  if (!keyValue) {
    await logAttempt(adminClient, {
      keyId: null,
      scriptId: scriptRow?.id ?? null,
      scriptSlug,
      hwid,
      ip,
      result: "key_required",
    });
    return NextResponse.json({ success: false, reason: "key_required" });
  }

  const { data: key, error: keyErr } = await withRetry(() =>
    adminClient
      .from("keys")
      .select("id, status, hwid, expires_at")
      .eq("key_value", keyValue)
      .maybeSingle(),
  );

  if (keyErr) {
    await logAttempt(adminClient, {
      keyId: null,
      scriptId: scriptRow?.id ?? null,
      scriptSlug,
      hwid,
      ip,
      result: "server_error",
    });
    return NextResponse.json(
      { success: false, reason: "server_error" },
      { status: 503 },
    );
  }

  if (!key) {
    await logAttempt(adminClient, {
      keyId: null,
      scriptId: scriptRow?.id ?? null,
      scriptSlug,
      hwid,
      ip,
      result: "invalid_key",
    });
    return NextResponse.json({ success: false, reason: "invalid_key" });
  }

  // Time-based expiry always wins, regardless of whatever `status` holds.
  // There's no cron flipping status to 'expired' when expires_at passes.
  const isTimeExpired =
    key.expires_at !== null && new Date(key.expires_at as string).getTime() < Date.now();

  let reason: ValidateReason | null = null;

  if (isTimeExpired || key.status === "expired") {
    reason = "expired";
  } else if (key.status === "banned") {
    reason = "banned";
  } else if (key.status === "paused") {
    reason = "paused";
  }

  let script: { id: string; content: string | null } | null = null;

  if (!reason) {
    const { data: access, error: accessErr } = await withRetry(() =>
      adminClient
        .from("key_scripts")
        .select("key_id")
        .eq("key_id", key.id as string)
        .eq("script_id", scriptRow.id as string)
        .maybeSingle(),
    );

    if (accessErr) {
      await logAttempt(adminClient, {
        keyId: key.id as string,
        scriptId: scriptRow.id as string,
        scriptSlug,
        hwid,
        ip,
        result: "server_error",
      });
      return NextResponse.json(
        { success: false, reason: "server_error" },
        { status: 503 },
      );
    }

    if (!access) {
      reason = "no_access";
    } else {
      script = scriptRow;
    }
  }

  let hwidAlreadyWritten = false;

  if (!reason && script) {
    if (!key.hwid) {
      // Compare-and-swap: only bind if hwid is STILL null at write time.
      // Without the `.is("hwid", null)` guard, two devices racing on first
      // use could both read hwid=null and both "win" an unconditional
      // update, binding the same key to two machines.
      const { data: bound, error: bindErr } = await adminClient
        .from("keys")
        .update({
          hwid,
          last_seen_at: new Date().toISOString(),
          last_ip: ip,
        })
        .eq("id", key.id as string)
        .is("hwid", null)
        .select("hwid")
        .maybeSingle();

      if (bindErr) {
        await logAttempt(adminClient, {
          keyId: key.id as string,
          scriptId: script.id,
          scriptSlug,
          hwid,
          ip,
          result: "server_error",
        });
        return NextResponse.json(
          { success: false, reason: "server_error" },
          { status: 503 },
        );
      }

      if (bound) {
        hwidAlreadyWritten = true;
      } else {
        // Lost the race: someone else bound first. Re-read and compare.
        const { data: current, error: rereadErr } = await adminClient
          .from("keys")
          .select("hwid")
          .eq("id", key.id as string)
          .maybeSingle();

        if (rereadErr) {
          await logAttempt(adminClient, {
            keyId: key.id as string,
            scriptId: script.id,
            scriptSlug,
            hwid,
            ip,
            result: "server_error",
          });
          return NextResponse.json(
            { success: false, reason: "server_error" },
            { status: 503 },
          );
        }

        // Only flag a mismatch when the re-read actually came back with a
        // non-null hwid that differs. A null/missing value here just means
        // the bind didn't land this time, not that another device owns it.
        if (current?.hwid != null && current.hwid !== hwid) {
          reason = "hwid_mismatch";
        }
      }
    } else if (key.hwid !== hwid) {
      reason = "hwid_mismatch";
    }
  }

  if (!hwidAlreadyWritten) {
    await adminClient
      .from("keys")
      .update({ last_seen_at: new Date().toISOString(), last_ip: ip })
      .eq("id", key.id as string);
  }

  await logAttempt(adminClient, {
    keyId: key.id as string,
    scriptId: script?.id ?? null,
    scriptSlug,
    hwid,
    ip,
    result: reason ?? "ok",
  });

  if (reason) {
    return NextResponse.json({ success: false, reason });
  }

  return NextResponse.json({ success: true, script: script!.content });
}
