import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, type AdminClient } from "@/lib/require-admin";
import { generateKeyValue } from "@/lib/keys";

const UNIQUE_VIOLATION = "23505";
const MAX_GENERATE_ATTEMPTS = 5;

const createSchema = z.object({
  label: z.string().trim().max(200).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  hwid_reset_limit: z.number().int().min(0).optional(),
  script_ids: z.array(z.string().uuid()).default([]),
  key_value: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Key may only contain letters, numbers, _ or -")
    .optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["reset-hwid"]).optional(),
  label: z.string().trim().max(200).optional(),
  status: z.enum(["active", "paused", "banned", "expired"]).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  hwid_reset_limit: z.number().int().min(0).optional(),
  script_ids: z.array(z.string().uuid()).optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function replaceKeyScripts(
  adminClient: AdminClient,
  keyId: string,
  scriptIds: string[],
) {
  await adminClient.from("key_scripts").delete().eq("key_id", keyId);
  if (scriptIds.length > 0) {
    await adminClient
      .from("key_scripts")
      .insert(scriptIds.map((scriptId) => ({ key_id: keyId, script_id: scriptId })));
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  let key: Record<string, unknown> | null = null;

  if (parsed.data.key_value) {
    const { data, error } = await auth.adminClient
      .from("keys")
      .insert({
        key_value: parsed.data.key_value,
        label: parsed.data.label || null,
        expires_at: parsed.data.expires_at ?? null,
        ...(parsed.data.hwid_reset_limit !== undefined
          ? { hwid_reset_limit: parsed.data.hwid_reset_limit }
          : {}),
      })
      .select()
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      return badRequest("That key already exists, choose another.");
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    key = data;
  } else {
    const { data: settings } = await auth.adminClient
      .from("settings")
      .select("key_prefix")
      .eq("id", 1)
      .maybeSingle();

    const prefix = (settings?.key_prefix as string | undefined) ?? "SYMBIOS";

    let lastErrorMessage = "Could not generate a unique key";

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS && !key; attempt++) {
      const { data, error } = await auth.adminClient
        .from("keys")
        .insert({
          key_value: generateKeyValue(prefix),
          label: parsed.data.label || null,
          expires_at: parsed.data.expires_at ?? null,
          ...(parsed.data.hwid_reset_limit !== undefined
            ? { hwid_reset_limit: parsed.data.hwid_reset_limit }
            : {}),
        })
        .select()
        .single();

      if (data) {
        key = data;
      } else if (error?.code === UNIQUE_VIOLATION) {
        lastErrorMessage = error.message;
        continue;
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (!key) {
      return NextResponse.json({ error: lastErrorMessage }, { status: 500 });
    }
  }

  if (parsed.data.script_ids.length > 0) {
    await auth.adminClient
      .from("key_scripts")
      .insert(
        parsed.data.script_ids.map((scriptId) => ({
          key_id: key!.id as string,
          script_id: scriptId,
        })),
      );
  }

  return NextResponse.json({ success: true, key }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id, action, script_ids: scriptIds, ...rest } = parsed.data;

  if (action === "reset-hwid") {
    // Admin-initiated reset: clears hwid but does NOT consume the
    // hwid_resets quota (that only applies to the user's own /panel reset).
    const { data: key, error } = await auth.adminClient
      .from("keys")
      .update({ hwid: null })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, key });
  }

  let key: Record<string, unknown> | null = null;

  if (Object.keys(rest).length > 0) {
    const { data, error } = await auth.adminClient
      .from("keys")
      .update(rest)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    key = data;
  }

  if (scriptIds) {
    await replaceKeyScripts(auth.adminClient, id, scriptIds);
  }

  return NextResponse.json({ success: true, key });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("id is required");
  }

  const { error } = await auth.adminClient
    .from("keys")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
