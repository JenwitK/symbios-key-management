import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

const SLUG_RE = /^[a-z0-9-]+$/;

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(SLUG_RE, "slug must be a-z, 0-9, and hyphens only"),
  content: z.string().optional(),
  source_content: z.string().optional(),
  obf_config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["active", "disabled"]).default("active"),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().regex(SLUG_RE, "slug must be a-z, 0-9, and hyphens only").optional(),
  content: z.string().optional(),
  source_content: z.string().optional(),
  obf_config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["active", "disabled"]).optional(),
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

  const { data: existing } = await auth.adminClient
    .from("scripts")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const { data: script, error } = await auth.adminClient
    .from("scripts")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      content: parsed.data.content ?? null,
      source_content: parsed.data.source_content ?? null,
      obf_config: parsed.data.obf_config ?? null,
      status: parsed.data.status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, script }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { id, slug, ...rest } = parsed.data;

  if (slug) {
    const { data: existing } = await auth.adminClient
      .from("scripts")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
  }

  const { data: current, error: fetchError } = await auth.adminClient
    .from("scripts")
    .select("version, content")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }

  const contentChanged =
    rest.content !== undefined && rest.content !== current.content;

  const { data: script, error } = await auth.adminClient
    .from("scripts")
    .update({
      ...rest,
      ...(slug ? { slug } : {}),
      updated_at: new Date().toISOString(),
      ...(contentChanged ? { version: (current.version as number) + 1 } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, script });
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
    .from("scripts")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
