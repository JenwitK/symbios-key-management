import Link from "next/link";
import { Badge } from "@/components/Badge/Badge";
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
  if (from) {
    query = query.gte("created_at", new Date(from).toISOString());
  }
  if (to) {
    query = query.lte("created_at", new Date(`${to}T23:59:59.999`).toISOString());
  }

  const offset = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  const logs = (data ?? []) as unknown as LogRow[];
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const currentQuery = { result, from, to, page: String(page) };

  return (
    <div>
      <h1 className={styles.pageTitle}>Logs</h1>
      <p className={styles.pageSubtitle}>
        Every /api/v1/validate attempt, most recent first.
      </p>

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

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Result</th>
            <th>Key</th>
            <th>Script</th>
            <th>HWID</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className={styles.mono}>{formatDateTime(log.created_at)}</td>
              <td>
                <Badge tone={RESULT_TONE[log.result] ?? "neutral"}>
                  {log.result}
                </Badge>
              </td>
              <td className={styles.mono}>{log.keys?.key_value ?? "—"}</td>
              <td className={styles.mono}>{log.scripts?.name ?? "—"}</td>
              <td className={styles.mono}>{log.hwid ?? "—"}</td>
              <td className={styles.mono}>{log.ip ?? "—"}</td>
            </tr>
          ))}
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                No log entries match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

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
