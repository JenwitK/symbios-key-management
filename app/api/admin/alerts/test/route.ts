import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { sendDiscord, ALERT_COLORS } from "@/lib/discord";

const testSchema = z.object({
  webhook_url: z.string().trim().url().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let webhookUrl = parsed.data.webhook_url;

  if (!webhookUrl) {
    const { data: settings } = await auth.adminClient
      .from("settings")
      .select("alert_webhook_url")
      .eq("id", 1)
      .maybeSingle();
    webhookUrl = (settings?.alert_webhook_url as string | null) ?? undefined;
  }

  if (!webhookUrl) {
    return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });
  }

  const result = await sendDiscord(webhookUrl, [
    {
      title: "SYMBIOS alert test",
      description: "This is a test alert from the SYMBIOS dashboard.",
      color: ALERT_COLORS.GREEN,
      fields: [
        { name: "Sent by", value: "Settings", inline: true },
        { name: "Status", value: "Webhook reachable", inline: true },
      ],
    },
  ]);

  if (!result.ok) {
    return NextResponse.json(
      { error: `Discord returned status ${result.status}` },
      { status: result.status || 502 },
    );
  }

  return NextResponse.json({ success: true });
}
