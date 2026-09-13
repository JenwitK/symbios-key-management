import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

// Public, Lua-facing endpoint with no session, so it goes straight to the
// service-role client. Do NOT put requireAdmin() on this route.

const DEFAULT_DISCORD_URL = "https://discord.gg/RWbYvbyB2";
const DEFAULT_AUTO_SECS = 15;

type AnnouncementRow = {
  tag: string | null;
  title: string | null;
  body: string | null;
  games: number[] | null;
};

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  if (isRateLimited(`announcement:${ip ?? "unknown"}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const adminClient = createAdminClient();

  const [{ data: settings }, { data: rows }] = await Promise.all([
    adminClient
      .from("settings")
      .select("discord_url, announce_auto_secs")
      .eq("id", 1)
      .maybeSingle(),
    adminClient
      .from("announcements")
      .select("tag, title, body, games")
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const entries = ((rows ?? []) as unknown as AnnouncementRow[]).map((r) => ({
    tag: r.tag,
    title: r.title,
    body: r.body,
    games: Array.isArray(r.games) ? r.games.map(Number) : null,
  }));

  const response = NextResponse.json({
    discord_url:
      (settings?.discord_url as string | undefined) ?? DEFAULT_DISCORD_URL,
    auto_secs:
      (settings?.announce_auto_secs as number | undefined) ?? DEFAULT_AUTO_SECS,
    entries,
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300",
  );

  return response;
}
