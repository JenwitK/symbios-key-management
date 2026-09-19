// Keep in sync with app/api/v1/validate/route.ts (read-only mirror).
// This route replicates the exact decision order of the loader-facing
// /api/v1/validate endpoint but never binds HWID, writes validation_logs,
// or updates last_seen/last_ip. Admin-only, for the Playground page.

import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const testSchema = z.object({
  key: z.string().trim().min(1).max(64).optional(),
  hwid: z.string().trim().min(1).max(128),
  script_slug: z.string().trim().min(1).max(200),
});

type ValidateReason =
  | "invalid_key"
  | "banned"
  | "paused"
  | "expired"
  | "no_access"
  | "hwid_mismatch"
  | "key_required"
  | "server_error"
  | "unknown_script"
  | "maintenance";

type LoaderResponse =
  | { success: true; script: string }
  | { success: false; reason: ValidateReason };

function scriptPreview(content: string) {
  return `<script: ${content.length} chars>`;
}

function respond(
  result: ValidateReason | "ok",
  httpStatus: number,
  loaderResponse: LoaderResponse,
  scriptChars: number | null,
  hwidNote: string | null,
  trace: string[],
) {
  return NextResponse.json({
    success: true,
    result,
    httpStatus,
    loaderResponse,
    scriptChars,
    hwidNote,
    trace,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { key: keyValue, hwid, script_slug: scriptSlug } = parsed.data;
  const adminClient = auth.adminClient;
  const trace: string[] = [];

  const { data: settingsRow } = await adminClient
    .from("settings")
    .select("maintenance")
    .eq("id", 1)
    .maybeSingle();

  if (settingsRow?.maintenance) {
    trace.push("maintenance mode is ON");
    return respond(
      "maintenance",
      503,
      { success: false, reason: "maintenance" },
      null,
      null,
      trace,
    );
  }

  const { data: scriptRow, error: scriptErr } = await adminClient
    .from("scripts")
    .select("id, content, keyless, status")
    .eq("slug", scriptSlug)
    .maybeSingle();

  if (scriptErr) {
    trace.push("script lookup failed");
    return respond(
      "server_error",
      503,
      { success: false, reason: "server_error" },
      null,
      null,
      trace,
    );
  }

  if (scriptRow && scriptRow.status === "maintenance") {
    trace.push(`script found: ${scriptSlug}`);
    trace.push("script is in maintenance");
    return respond(
      "maintenance",
      503,
      { success: false, reason: "maintenance" },
      null,
      null,
      trace,
    );
  }

  if (scriptRow?.keyless === true) {
    trace.push(`script found: ${scriptSlug} (keyless)`);
    const content = scriptRow.content as string | null;

    if (typeof content !== "string" || content.length === 0) {
      trace.push("keyless script has no content");
      return respond(
        "server_error",
        500,
        { success: false, reason: "server_error" },
        null,
        null,
        trace,
      );
    }

    trace.push("keyless: ok");
    return respond(
      "ok",
      200,
      { success: true, script: scriptPreview(content) },
      content.length,
      null,
      trace,
    );
  }

  if (!scriptRow) {
    trace.push(`script not found: ${scriptSlug}`);
    return respond(
      "unknown_script",
      404,
      { success: false, reason: "unknown_script" },
      null,
      null,
      trace,
    );
  }

  trace.push(`script found: ${scriptSlug}`);

  if (!keyValue) {
    trace.push("no key provided");
    return respond(
      "key_required",
      200,
      { success: false, reason: "key_required" },
      null,
      null,
      trace,
    );
  }

  const { data: key, error: keyErr } = await adminClient
    .from("keys")
    .select("id, status, hwid, expires_at")
    .eq("key_value", keyValue)
    .maybeSingle();

  if (keyErr) {
    trace.push("key lookup failed");
    return respond(
      "server_error",
      503,
      { success: false, reason: "server_error" },
      null,
      null,
      trace,
    );
  }

  if (!key) {
    trace.push("key not found");
    return respond(
      "invalid_key",
      200,
      { success: false, reason: "invalid_key" },
      null,
      null,
      trace,
    );
  }

  trace.push("key found");

  const isTimeExpired =
    key.expires_at !== null && new Date(key.expires_at as string).getTime() < Date.now();

  if (isTimeExpired || key.status === "expired") {
    trace.push("expired");
    return respond(
      "expired",
      200,
      { success: false, reason: "expired" },
      null,
      null,
      trace,
    );
  }

  if (key.status === "banned") {
    trace.push("banned");
    return respond(
      "banned",
      200,
      { success: false, reason: "banned" },
      null,
      null,
      trace,
    );
  }

  if (key.status === "paused") {
    trace.push("paused");
    return respond(
      "paused",
      200,
      { success: false, reason: "paused" },
      null,
      null,
      trace,
    );
  }

  trace.push("not expired");

  const { data: access, error: accessErr } = await adminClient
    .from("key_scripts")
    .select("key_id")
    .eq("key_id", key.id as string)
    .eq("script_id", scriptRow.id as string)
    .maybeSingle();

  if (accessErr) {
    trace.push("access lookup failed");
    return respond(
      "server_error",
      503,
      { success: false, reason: "server_error" },
      null,
      null,
      trace,
    );
  }

  if (!access) {
    trace.push("no access to script");
    return respond(
      "no_access",
      200,
      { success: false, reason: "no_access" },
      null,
      null,
      trace,
    );
  }

  trace.push("has access");

  let hwidNote: string | null = null;

  if (!key.hwid) {
    hwidNote = "First use: the real endpoint would bind this HWID.";
    trace.push("no hwid bound yet (would bind)");
  } else if (key.hwid !== hwid) {
    trace.push("hwid mismatch");
    return respond(
      "hwid_mismatch",
      200,
      { success: false, reason: "hwid_mismatch" },
      null,
      null,
      trace,
    );
  } else {
    trace.push("hwid match");
  }

  const content = scriptRow.content as string | null;
  const chars = typeof content === "string" ? content.length : 0;

  return respond(
    "ok",
    200,
    { success: true, script: scriptPreview(content ?? "") },
    chars,
    hwidNote,
    trace,
  );
}
