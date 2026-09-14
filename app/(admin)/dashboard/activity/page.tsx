import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { ActivityFeed, type ActivityRow } from "./ActivityFeed";
import styles from "./activity.module.css";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("validation_logs")
    .select("id, result, script_slug, hwid, ip, created_at, keys(key_value)")
    .order("id", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as ActivityRow[];

  return (
    <div>
      <h1 className={styles.pageTitle}>Activity</h1>
      <p className={styles.pageSubtitle}>Live validate attempts from the loader.</p>

      <ActivityFeed initialRows={rows} initialLatestId={rows[0]?.id ?? null} />
    </div>
  );
}
