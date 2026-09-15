import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const idsSchema = z.array(z.string().uuid()).min(1).max(500);

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-status"),
    ids: idsSchema,
    status: z.enum(["active", "paused", "banned", "expired"]),
  }),
  z.object({
    action: z.literal("extend"),
    ids: idsSchema,
    days: z.number().int().min(1).max(3650),
  }),
  z.object({
    action: z.literal("set-expiry"),
    ids: idsSchema,
    expires_at: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("delete"),
    ids: idsSchema,
  }),
  z.object({
    action: z.literal("reset-hwid"),
    ids: idsSchema,
  }),
]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const data = parsed.data;

  if (data.action === "set-status") {
    const { data: rows, error } = await auth.adminClient
      .from("keys")
      .update({ status: data.status })
      .in("id", data.ids)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, affected: rows?.length ?? 0 });
  }

  if (data.action === "set-expiry") {
    const { data: rows, error } = await auth.adminClient
      .from("keys")
      .update({ expires_at: data.expires_at })
      .in("id", data.ids)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, affected: rows?.length ?? 0 });
  }

  if (data.action === "reset-hwid") {
    // Admin-initiated reset: clears hwid but does NOT consume the
    // hwid_resets quota, same as the single-key PATCH reset-hwid action.
    const { data: rows, error } = await auth.adminClient
      .from("keys")
      .update({ hwid: null })
      .in("id", data.ids)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, affected: rows?.length ?? 0 });
  }

  if (data.action === "delete") {
    const { data: rows, error } = await auth.adminClient
      .from("keys")
      .delete()
      .in("id", data.ids)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, affected: rows?.length ?? 0 });
  }

  // extend: base = max(now, existing expires_at), or now when null, then + days.
  // Done in one round trip via the bulk_extend_keys() SQL function instead of
  // one UPDATE per key.
  const { data: affected, error } = await auth.adminClient.rpc("bulk_extend_keys", {
    p_ids: data.ids,
    p_days: data.days,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, affected: affected ?? 0 });
}
