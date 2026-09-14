import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  after: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    after: searchParams.get("after") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { after, limit } = parsed.data;

  let q = auth.adminClient
    .from("validation_logs")
    .select("id, result, script_slug, hwid, ip, created_at, keys(key_value)")
    .order("id", { ascending: false })
    .limit(limit ?? 50);

  if (after) {
    q = q.gt("id", after);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  return NextResponse.json({
    success: true,
    rows,
    latestId: rows[0]?.id ?? after ?? null,
  });
}
