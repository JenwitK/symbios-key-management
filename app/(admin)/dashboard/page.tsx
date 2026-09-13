import Link from "next/link";
import { Badge } from "@/components/Badge/Badge";
import { AreaChart } from "@/components/AreaChart/AreaChart";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import styles from "./overview.module.css";

const SPARK_DAYS = 14;
const MISMATCH_ALERT = 10;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type DayRow = {
  day: string;
  executions: number;
  unique_devices: number;
};

type ResultRow = {
  result: string;
  count: number;
};

type KeylessEmptyScript = {
  id: string;
  name: string;
  slug: string;
};

type RecentLog = {
  id: number;
  result: string;
  script_slug: string | null;
  created_at: string;
};

type Alert = {
  tone: "ok" | "warn" | "err" | "neutral";
  message: string;
  href: string;
};

const ALERT_BADGE_LABEL: Record<Alert["tone"], string> = {
  err: "Critical",
  warn: "Warning",
  neutral: "Notice",
  ok: "All clear",
};

const RESULT_TONE: Record<string, "ok" | "warn" | "err" | "neutral"> = {
  ok: "ok",
  key_required: "neutral",
  invalid_key: "err",
  banned: "err",
  hwid_mismatch: "err",
  paused: "warn",
  expired: "warn",
  no_access: "warn",
  unknown_script: "warn",
  server_error: "err",
};

function bangkokDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    date,
  );
}

function formatDay(day: string): string {
  const parts = day.split("-");
  const month = Number(parts[1] ?? "1");
  const date = Number(parts[2] ?? "1");
  return `${MONTH_LABELS[month - 1] ?? parts[1]} ${date}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

export default async function DashboardOverviewPage() {
  const now = new Date();
  const last14 = new Date(now.getTime() - (SPARK_DAYS - 1) * 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const adminClient = createAdminClient();

  const [
    dayResult,
    activeKeysResult,
    scriptsTotalResult,
    keysExpiringResult,
    breakdown24hResult,
    keylessEmptyResult,
    recentResult,
  ] = await Promise.all([
    adminClient.rpc("executions_by_day", {
      from_ts: last14.toISOString(),
      to_ts: now.toISOString(),
    }),
    adminClient
      .from("keys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    adminClient.from("scripts").select("*", { count: "exact", head: true }),
    adminClient
      .from("keys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", next7d.toISOString()),
    adminClient.rpc("result_breakdown", {
      from_ts: last24h.toISOString(),
      to_ts: now.toISOString(),
    }),
    adminClient
      .from("scripts")
      .select("id, name, slug")
      .eq("keyless", true)
      .or("content.is.null,content.eq."),
    adminClient
      .from("validation_logs")
      .select("id, result, script_slug, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const dayRows = (
    dayResult.error ? [] : (dayResult.data ?? [])
  ) as unknown as DayRow[];
  const activeKeysCount = activeKeysResult.error
    ? 0
    : (activeKeysResult.count ?? 0);
  const scriptsTotalCount = scriptsTotalResult.error
    ? 0
    : (scriptsTotalResult.count ?? 0);
  const keysExpiringCount = keysExpiringResult.error
    ? 0
    : (keysExpiringResult.count ?? 0);
  const breakdown24hRows = (
    breakdown24hResult.error ? [] : (breakdown24hResult.data ?? [])
  ) as unknown as ResultRow[];
  const keylessEmptyScripts = (
    keylessEmptyResult.error ? [] : (keylessEmptyResult.data ?? [])
  ) as unknown as KeylessEmptyScript[];
  const recentLogs = (
    recentResult.error ? [] : (recentResult.data ?? [])
  ) as unknown as RecentLog[];

  const days: string[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    days.push(
      bangkokDateString(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)),
    );
  }

  const byDay = new Map(dayRows.map((row) => [row.day, row]));
  const series = days.map((day) => ({
    day,
    executions: byDay.get(day)?.executions ?? 0,
    unique_devices: byDay.get(day)?.unique_devices ?? 0,
  }));

  const todayExecutions = series[series.length - 1]?.executions ?? 0;
  const todayUniqueDevices = series[series.length - 1]?.unique_devices ?? 0;
  const yesterdayExecutions = series[series.length - 2]?.executions ?? 0;
  const executionsDelta = todayExecutions - yesterdayExecutions;
  const deltaTone: "ok" | "err" | "neutral" =
    executionsDelta > 0 ? "ok" : executionsDelta < 0 ? "err" : "neutral";
  const deltaLabel =
    executionsDelta > 0 ? `+${executionsDelta}` : `${executionsDelta}`;

  const breakdownMap = new Map(breakdown24hRows.map((r) => [r.result, r.count]));
  const hwidMismatch24h = breakdownMap.get("hwid_mismatch") ?? 0;
  const serverError24h = breakdownMap.get("server_error") ?? 0;
  const unknownScript24h = breakdownMap.get("unknown_script") ?? 0;

  const kpis: {
    label: string;
    value: number;
    tone: "ok" | "warn" | "err" | "neutral";
    delta?: { label: string; tone: "ok" | "err" | "neutral" };
  }[] = [
    { label: "Active keys", value: activeKeysCount, tone: "ok" },
    {
      label: "Executions today",
      value: todayExecutions,
      tone: "neutral",
      delta: { label: `${deltaLabel} vs yesterday`, tone: deltaTone },
    },
    {
      label: "Unique devices today",
      value: todayUniqueDevices,
      tone: "neutral",
    },
    {
      label: "HWID mismatches (24h)",
      value: hwidMismatch24h,
      tone: "warn",
    },
    { label: "Total scripts", value: scriptsTotalCount, tone: "neutral" },
    {
      label: "Keys expiring (7d)",
      value: keysExpiringCount,
      tone: keysExpiringCount > 0 ? "warn" : "neutral",
    },
  ];

  const alerts: Alert[] = [];

  if (keylessEmptyScripts.length > 0) {
    alerts.push({
      tone: "err",
      message: `${keylessEmptyScripts.length} keyless script(s) have no content (players get SERVER BUSY).`,
      href: "/dashboard/scripts",
    });
  }
  if (serverError24h > 0) {
    alerts.push({
      tone: "warn",
      message: `${serverError24h} server_error in 24h.`,
      href: "/dashboard/logs?result=server_error",
    });
  }
  if (unknownScript24h > 0) {
    alerts.push({
      tone: "warn",
      message: `${unknownScript24h} unknown_script in 24h (a game may be missing its script).`,
      href: "/dashboard/logs?result=unknown_script",
    });
  }
  if (hwidMismatch24h >= MISMATCH_ALERT) {
    alerts.push({
      tone: "warn",
      message: `${hwidMismatch24h} HWID mismatches in 24h (possible key sharing).`,
      href: "/dashboard/logs?result=hwid_mismatch",
    });
  }
  if (keysExpiringCount > 0) {
    alerts.push({
      tone: "neutral",
      message: `${keysExpiringCount} key(s) expiring within 7 days.`,
      href: "/dashboard/keys",
    });
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Overview</h1>
      <p className={styles.pageSubtitle}>
        Keys, executions, and anything that needs your attention.
      </p>

      <div className={styles.statGrid}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.statCard}>
            <Badge tone={kpi.tone}>{kpi.label}</Badge>
            <span className={styles.statValue}>{kpi.value}</span>
            {kpi.delta ? (
              <span
                className={`${styles.statDelta} ${
                  kpi.delta.tone === "ok"
                    ? styles.deltaOk
                    : kpi.delta.tone === "err"
                      ? styles.deltaErr
                      : styles.deltaNeutral
                }`}
              >
                {kpi.delta.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Executions, last 14 days</h2>
        <div className={styles.chartCard}>
          <AreaChart
            points={series.map((d) => ({
              label: formatDay(d.day),
              value: d.executions,
            }))}
            height={120}
            ariaLabel="Executions, last 14 days"
          />
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent activity</h2>
          {recentLogs.length === 0 ? (
            <div className={styles.empty}>No activity yet.</div>
          ) : (
            <div className={styles.activityList}>
              {recentLogs.map((log) => (
                <div key={log.id} className={styles.activityRow}>
                  <span className={`${styles.activityTime} ${styles.mono}`}>
                    {formatDateTime(log.created_at)}
                  </span>
                  <Badge tone={RESULT_TONE[log.result] ?? "neutral"}>
                    {log.result}
                  </Badge>
                  <span className={`${styles.activitySlug} ${styles.mono}`}>
                    {log.script_slug ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Needs attention</h2>
          <div className={styles.alertList}>
            {alerts.length === 0 ? (
              <div className={styles.alertRow}>
                <Badge tone="ok">All clear</Badge>
                <span>Nothing needs attention.</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <Link
                  key={alert.message}
                  href={alert.href}
                  className={styles.alertRow}
                >
                  <Badge tone={alert.tone}>{ALERT_BADGE_LABEL[alert.tone]}</Badge>
                  <span>{alert.message}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
