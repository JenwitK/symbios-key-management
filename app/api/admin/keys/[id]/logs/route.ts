import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

const RESULT_VALUES = [
  "ok",
  "key_required",
  "invalid_key",
  "hwid_mismatch",
  "expired",
  "banned",
  "paused",
  "no_access",
  "unknown_script",
  "server_error",
  "maintenance",
] as const;

const ERROR_RESULTS = [
  "hwid_mismatch",
  "banned",
  "expired",
  "no_access",
  "invalid_key",
] as const;

const querySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  result: z.union([z.enum(RESULT_VALUES), z.literal("errors")]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    before: searchParams.get("before") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    result: searchParams.get("result") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { before, limit, result } = parsed.data;
  const pageSize = limit ?? 50;

  let q = auth.adminClient
    .from("validation_logs")
    .select("id, result, script_slug, hwid, ip, created_at")
    .eq("key_id", id)
    .order("id", { ascending: false })
    .limit(pageSize);

  if (before) {
    q = q.lt("id", before);
  }
  if (result === "errors") {
    q = q.in("result", ERROR_RESULTS);
  } else if (result) {
    q = q.eq("result", result);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const nextCursor = rows.length === pageSize ? rows[rows.length - 1].id : null;

  return NextResponse.json({ success: true, rows, nextCursor });
}
