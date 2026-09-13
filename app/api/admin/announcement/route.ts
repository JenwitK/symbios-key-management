import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const createSchema = z.object({
  tag: z.string().trim().optional(),
  title: z.string().trim().optional(),
  body: z.string().trim().optional(),
  games: z.array(z.number().int()).nullable().optional(),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  tag: z.string().trim().optional(),
  title: z.string().trim().optional(),
  body: z.string().trim().optional(),
  games: z.array(z.number().int()).nullable().optional(),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { data: announcement, error } = await auth.adminClient
    .from("announcements")
    .insert({
      tag: parsed.data.tag || null,
      title: parsed.data.title || null,
      body: parsed.data.body || null,
      games: parsed.data.games ?? null,
      enabled: parsed.data.enabled ?? true,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, announcement }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id, ...rest } = parsed.data;

  if (Object.keys(rest).length === 0) {
    return badRequest("Nothing to update");
  }

  const { data: announcement, error } = await auth.adminClient
    .from("announcements")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, announcement });
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
    .from("announcements")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
