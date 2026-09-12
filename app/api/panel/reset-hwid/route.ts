import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/require-user";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

const resetSchema = z.object({
  key_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "key_id is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: key } = await adminClient
    .from("keys")
    .select("id, discord_id, hwid_resets, hwid_reset_limit")
    .eq("id", parsed.data.key_id)
    .maybeSingle();

  // Not found OR belongs to someone else — same 404 either way, so we don't
  // leak whether a given key id exists.
  if (!key || key.discord_id !== auth.discordId) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  const used = key.hwid_resets as number;
  const limit = key.hwid_reset_limit as number;

  if (used >= limit) {
    return NextResponse.json(
      { error: "No HWID resets remaining on this key." },
      { status: 409 },
    );
  }

  // CAS on hwid_resets guards a double-spend from a duplicate/rapid
  // double-click both reading the same "used" count.
  const { data: updated, error } = await adminClient
    .from("keys")
    .update({ hwid: null, hwid_resets: used + 1 })
    .eq("id", key.id as string)
    .eq("discord_id", auth.discordId)
    .eq("hwid_resets", used)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Reset was already used elsewhere — refresh and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, key: updated });
}
