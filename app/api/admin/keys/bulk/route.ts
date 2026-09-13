import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { generateKeyValue } from "@/lib/keys";

const UNIQUE_VIOLATION = "23505";
const MAX_BATCH_ATTEMPTS = 3;

const bulkSchema = z.object({
  count: z.number().int().min(1).max(100),
  label: z.string().trim().max(200).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  hwid_reset_limit: z.number().int().min(0).optional(),
  script_ids: z.array(z.string().uuid()).default([]),
});

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

  const { count, label, expires_at, hwid_reset_limit, script_ids } = parsed.data;

  const { data: settings } = await auth.adminClient
    .from("settings")
    .select("key_prefix")
    .eq("id", 1)
    .maybeSingle();

  const prefix = (settings?.key_prefix as string | undefined) ?? "SYMBIOS";

  let inserted: { id: string; key_value: string }[] | null = null;
  let lastErrorMessage = "Could not generate unique keys";

  for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS && !inserted; attempt++) {
    const keyValues = new Set<string>();
    while (keyValues.size < count) {
      keyValues.add(generateKeyValue(prefix));
    }

    const rows = Array.from(keyValues).map((keyValue) => ({
      key_value: keyValue,
      label: label || null,
      expires_at: expires_at ?? null,
      ...(hwid_reset_limit !== undefined ? { hwid_reset_limit } : {}),
    }));

    const { data, error } = await auth.adminClient
      .from("keys")
      .insert(rows)
      .select("id, key_value");

    if (data) {
      inserted = data;
    } else if (error?.code === UNIQUE_VIOLATION) {
      lastErrorMessage = error.message;
      continue;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!inserted) {
    return NextResponse.json({ error: lastErrorMessage }, { status: 500 });
  }

  if (script_ids.length > 0) {
    const keyScriptRows = inserted.flatMap((key) =>
      script_ids.map((scriptId) => ({ key_id: key.id, script_id: scriptId })),
    );
    await auth.adminClient.from("key_scripts").insert(keyScriptRows);
  }

  return NextResponse.json({ success: true, keys: inserted }, { status: 201 });
}
