import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/require-user";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

const linkKeySchema = z.object({
  key_value: z.string().trim().min(1).max(64),
});

const unlinkKeySchema = z.object({
  key_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = linkKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();

  const { data: key } = await adminClient
    .from("keys")
    .select("id, discord_id")
    .eq("key_value", parsed.data.key_value)
    .maybeSingle();

  if (!key) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  if (key.discord_id) {
    return NextResponse.json(
      { error: "This key is already linked to an account." },
      { status: 409 },
    );
  }

  // Compare-and-swap: only claim if discord_id is STILL null at write time.
  // Guards two link attempts racing on the same unlinked key.
  const { data: linked, error } = await adminClient
    .from("keys")
    .update({ discord_id: auth.discordId })
    .eq("id", key.id as string)
    .is("discord_id", null)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!linked) {
    return NextResponse.json(
      { error: "This key is already linked to an account." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, key: linked });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = unlinkKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "key_id is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Only unlink if it's still ours: same 404 whether it's someone else's
  // key or doesn't exist, so we don't leak which.
  const { data: unlinked, error } = await adminClient
    .from("keys")
    .update({ discord_id: null })
    .eq("id", parsed.data.key_id)
    .eq("discord_id", auth.discordId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!unlinked) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, key: unlinked });
}
