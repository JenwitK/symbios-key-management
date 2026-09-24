import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const safeQ = parsed.data.q.replace(/[,()%\\]/g, "");

  const { data, error } = await auth.adminClient
    .from("keys")
    .select("id, key_value, status, label, discord_id, expires_at")
    .or(
      `key_value.ilike.%${safeQ}%,label.ilike.%${safeQ}%,discord_id.ilike.%${safeQ}%`,
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, keys: data ?? [] });
}
