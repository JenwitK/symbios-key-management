import Link from "next/link";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import styles from "./logs.module.css";

const PAGE_SIZE = 25;

const RESULT_OPTIONS = [
  "all",
  "ok",
  "invalid_key",
  "banned",
  "paused",
  "expired",
  "no_access",
  "hwid_mismatch",
] as const;

const RESULT_TONE: Record<string, "ok" | "warn" | "err" | "neutral"> = {
  ok: "ok",
  invalid_key: "err",
  banned: "err",
  hwid_mismatch: "err",
  paused: "warn",
  expired: "warn",
  no_access: "warn",
};

type TopScript = {
  script_id: string;
  name: string;
  slug: string;
  executions: number;
};

type LogRow = {
  id: number;
  result: string;
  hwid: string | null;
  ip: string | null;
  created_at: string;
  keys: { key_value: string } | null;
  scripts: { name: string } | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function buildQuery(
  current: Record<string, string>,
  overrides: Record<string, string>,
) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/dashboard/logs?${qs}` : "/dashboard/logs";
}

export default async function LogsPage({
  searchParams,
}: PageProps<"/dashboard/logs">) {
  const params = await searchParams;
  const result = typeof params.result === "string" ? params.result : "all";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const page = Math.max(1, Number(params.page) || 1);

  const fromTs = from ? new Date(`${from}T00:00:00+07:00`).toISOString() : null;
  const toTs = to ? new Date(`${to}T23:59:59.999+07:00`).toISOString() : null;

  const adminClient = createAdminClient();
  let query = adminClient
    .from("validation_logs")
    .select("id, result, hwid, ip, created_at, keys(key_value), scripts(name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (result !== "all") {
    query = query.eq("result", result);
  }
  if (fromTs) {
    query = query.gte("created_at", fromTs);
  }
  if (toTs) {
    query = query.lte("created_at", toTs);
  }

  const offset = (page - 1) * PAGE_SIZE;
  const [{ data, count }, { data: statsData }, { data: topScriptsData }] =
    await Promise.all([
      query.range(offset, offset + PAGE_SIZE - 1),
      adminClient.rpc("execution_stats", { from_ts: fromTs, to_ts: toTs }),
      adminClient.rpc("top_scripts", { from_ts: fromTs, to_ts: toTs, lim: 10 }),
    ]);

  const topScripts = (topScriptsData ?? []) as unknown as TopScript[];

  const logs = (data ?? []) as unknown as LogRow[];
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const currentQuery = { result, from, to, page: String(page) };

  const executionStats = (statsData?.[0] ?? {
    total_executions: 0,
    unique_devices: 0,
  }) as { total_executions: number; unique_devices: number };

  const stats = [
    {
      label: "Executions",
      value: executionStats.total_executions,
      tone: "ok" as const,
    },
    {
      label: "Unique devices",
      value: executionStats.unique_devices,
      tone: "neutral" as const,
    },
  ];

  return (
    <div>
      <h1 className={styles.pageTitle}>Logs</h1>
      <p className={styles.pageSubtitle}>
        Every /api/v1/validate attempt, most recent first.
      </p>

      <div className={styles.statGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <span className={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>

      <section className={styles.topScripts}>
        <h2 className={styles.sectionTitle}>Top scripts</h2>
        {topScripts.length === 0 ? (
          <div className={styles.topScriptsEmpty}>
            No executions in this range yet.
          </div>
        ) : (
          <ol className={styles.rankList}>
            {topScripts.map((script, i) => (
              <li key={script.script_id} className={styles.rankRow}>
                <span className={styles.rankIndex}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.rankName}>{script.name}</span>
                <span className={styles.rankSlug}>{script.slug}</span>
                <span className={styles.rankCount}>{script.executions}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form method="get" className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.label}>Result</span>
          <select
            name="result"
            defaultValue={result}
            className={styles.input}
          >
            {RESULT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>From</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>To</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className={styles.input}
          />
        </label>

        <button type="submit" className={styles.filterButton}>
          Filter
        </button>
      </form>

      <div className={styles.tableWrap}>
        <div className={styles.table}>
          <div className={styles.row}>
            <div className={styles.headerCell}>Time</div>
            <div className={styles.headerCell}>Result</div>
            <div className={styles.headerCell}>Key</div>
            <div className={styles.headerCell}>Script</div>
            <div className={styles.headerCell}>HWID</div>
            <div className={styles.headerCell}>IP</div>
          </div>

          {logs.map((log) => (
            <div key={log.id} className={styles.row}>
              <div className={`${styles.cell} ${styles.mono} ${styles.time}`}>
                {formatDateTime(log.created_at)}
              </div>
              <div className={styles.cell}>
                <Badge tone={RESULT_TONE[log.result] ?? "neutral"}>
                  {log.result}
                </Badge>
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {log.keys?.key_value ?? "-"}
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {log.scripts?.name ?? "-"}
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                <HwidCell hwid={log.hwid} />
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {log.ip ?? "-"}
              </div>
            </div>
          ))}

          {logs.length === 0 ? (
            <div className={styles.empty}>
              No log entries match these filters.
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.pagination}>
        <Link
          href={buildQuery(currentQuery, { page: String(Math.max(1, page - 1)) })}
          aria-disabled={page <= 1}
          className={page <= 1 ? styles.pageLinkDisabled : styles.pageLink}
        >
          Previous
        </Link>
        <span className={styles.pageStatus}>
          Page {page} of {totalPages}
        </span>
        <Link
          href={buildQuery(currentQuery, {
            page: String(Math.min(totalPages, page + 1)),
          })}
          aria-disabled={page >= totalPages}
          className={page >= totalPages ? styles.pageLinkDisabled : styles.pageLink}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
