import { Badge } from "@/components/Badge/Badge";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import styles from "./dashboard.module.css";

export default async function DashboardOverviewPage() {
  const adminClient = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [activeKeys, validationsToday, hwidMismatches24h] = await Promise.all([
    adminClient
      .from("keys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    adminClient
      .from("validation_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString()),
    adminClient
      .from("validation_logs")
      .select("*", { count: "exact", head: true })
      .eq("result", "hwid_mismatch")
      .gte("created_at", last24h),
  ]);

  const stats = [
    {
      label: "Active keys",
      value: activeKeys.count ?? 0,
      tone: "ok" as const,
    },
    {
      label: "Validations today",
      value: validationsToday.count ?? 0,
      tone: "neutral" as const,
    },
    {
      label: "HWID mismatches (24h)",
      value: hwidMismatches24h.count ?? 0,
      tone: "warn" as const,
    },
  ];

  return (
    <div>
      <h1 className={styles.pageTitle}>Overview</h1>
      <p className={styles.pageSubtitle}>
        Active keys, today&apos;s validation traffic, and recent HWID
        mismatches.
      </p>

      <div className={styles.statGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <span className={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
