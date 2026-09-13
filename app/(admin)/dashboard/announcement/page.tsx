import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { AnnouncementManager, type AnnouncementRow } from "./AnnouncementManager";

export default async function AnnouncementPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("announcements")
    .select("id, tag, title, body, games, enabled, sort_order, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const entries = (data ?? []) as AnnouncementRow[];

  return <AnnouncementManager entries={entries} />;
}
