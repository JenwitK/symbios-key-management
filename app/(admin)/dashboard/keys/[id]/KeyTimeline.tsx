"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import styles from "./keyDetail.module.css";

export type TimelineRow = {
  id: number;
  result: string;
  script_slug: string | null;
  hwid: string | null;
  ip: string | null;
  created_at: string;
};

export type KeyDetailRow = {
  id: string;
  key_value: string;
  label: string | null;
  status: "active" | "paused" | "banned" | "expired";
  hwid: string | null;
  hwid_resets: number;
  hwid_reset_limit: number;
  expires_at: string | null;
  discord_id: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  created_at: string;
};

export type ScriptAccess = {
  name: string;
  slug: string;
};

const STATUS_TONE: Record<
  KeyDetailRow["status"],
  "ok" | "warn" | "err" | "neutral"
> = {
  active: "ok",
  paused: "warn",
  banned: "err",
  expired: "neutral",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function formatExpiry(iso: string | null) {
  if (!iso) return "Lifetime";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function expiryCountdown(iso: string | null) {
  if (!iso) return null;
  const diffDays = Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY);
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function KeyHeaderCard({
  keyRow,
  scripts,
}: {
  keyRow: KeyDetailRow;
  scripts: ScriptAccess[];
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(keyRow.key_value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard denied, nothing to do
    }
  }

  const resetsLeft = Math.max(keyRow.hwid_reset_limit - keyRow.hwid_resets, 0);
  const countdown = expiryCountdown(keyRow.expires_at);

  return (
    <div className={styles.headerCard}>
      <div className={styles.headerTop}>
        <div className={styles.keyValueRow}>
          <span className={styles.keyValue}>{keyRow.key_value}</span>
          <button type="button" className={styles.copyButton} onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <Badge tone={STATUS_TONE[keyRow.status]}>{keyRow.status}</Badge>
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Label</span>
          <span className={styles.fieldValue}>{keyRow.label || "-"}</span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>HWID</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {keyRow.hwid ? <HwidCell hwid={keyRow.hwid} /> : "unbound"}
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Resets</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {keyRow.hwid_resets}/{keyRow.hwid_reset_limit} ({resetsLeft} left)
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Expires</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {formatExpiry(keyRow.expires_at)}
            {countdown ? ` (${countdown})` : ""}
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Discord</span>
          <span className={styles.fieldValue}>
            {keyRow.discord_id ? (
              <a
                href={`https://discord.com/users/${keyRow.discord_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.discordLink}
              >
                {keyRow.discord_id}
              </a>
            ) : (
              "-"
            )}
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Last seen</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {formatDate(keyRow.last_seen_at)}
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Last IP</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {keyRow.last_ip ?? "-"}
          </span>
        </div>

        <div className={styles.fieldItem}>
          <span className={styles.fieldLabel}>Created</span>
          <span className={`${styles.fieldValue} ${styles.mono}`}>
            {formatDate(keyRow.created_at)}
          </span>
        </div>
      </div>

      <div className={styles.scriptAccess}>
        <span className={styles.fieldLabel}>Script access</span>
        {scripts.length > 0 ? (
          <div className={styles.chipRow}>
            {scripts.map((script) => (
              <span key={script.slug} className={styles.chip}>
                {script.name} ({script.slug})
              </span>
            ))}
          </div>
        ) : (
          <span className={styles.muted}>No scripts</span>
        )}
      </div>
    </div>
  );
}

// ---- Timeline ----

type FilterKey = "all" | "ok" | "errors" | "mismatch";

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  ok: "OK",
  errors: "Errors",
  mismatch: "Mismatch",
};

function resultDotTone(result: string): "ok" | "err" | "warn" | "neutral" {
  if (result === "ok") return "ok";
  if (result === "hwid_mismatch" || result === "expired" || result === "banned") {
    return "err";
  }
  if (result === "paused" || result === "no_access" || result === "key_required") {
    return "warn";
  }
  return "neutral";
}

function dotClass(tone: "ok" | "err" | "warn" | "neutral") {
  const toneClass = {
    ok: styles.dotOk,
    err: styles.dotErr,
    warn: styles.dotWarn,
    neutral: styles.dotNeutral,
  }[tone];
  return `${styles.dot} ${toneClass}`;
}

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    dateStyle: "full",
    timeZone: "Asia/Bangkok",
  });
}

function relativeTime(nowMs: number, iso: string) {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

type DayGroup = {
  key: string;
  label: string;
  rows: TimelineRow[];
};

function groupByDay(rows: TimelineRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();

  for (const row of rows) {
    const key = dayKey(row.created_at);
    let group = index.get(key);
    if (!group) {
      group = { key, label: dayLabel(row.created_at), rows: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }

  return groups;
}

function serverResultParam(filter: FilterKey): string | undefined {
  if (filter === "ok") return "ok";
  if (filter === "mismatch") return "hwid_mismatch";
  if (filter === "errors") return "errors";
  return undefined;
}

type KeyTimelineProps = {
  keyId: string;
  initialRows: TimelineRow[];
  initialNextCursor: number | null;
};

export function KeyTimeline({ keyId, initialRows, initialNextCursor }: KeyTimelineProps) {
  const [rows, setRows] = useState<TimelineRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isFirstRender = useRef(true);

  useEffect(() => {
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, []);

  async function fetchPage(options: {
    before?: number;
    result?: string;
    replace: boolean;
  }) {
    const params = new URLSearchParams();
    if (options.before) params.set("before", String(options.before));
    if (options.result) params.set("result", options.result);
    const qs = params.toString();

    try {
      const res = await fetch(
        `/api/admin/keys/${keyId}/logs${qs ? `?${qs}` : ""}`,
        { cache: "no-store" },
      );
      const json: {
        rows?: TimelineRow[];
        nextCursor?: number | null;
        error?: string;
      } = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Could not load timeline.");
        return;
      }

      setError(null);
      const incoming = json.rows ?? [];
      setRows((current) => (options.replace ? incoming : [...current, ...incoming]));
      setNextCursor(json.nextCursor ?? null);
    } catch {
      setError("Could not reach the server.");
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setIsRefetching(true);
    fetchPage({ result: serverResultParam(filter), replace: true }).finally(() =>
      setIsRefetching(false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchPage({
      before: nextCursor,
      result: serverResultParam(filter),
      replace: false,
    });
    setIsLoadingMore(false);
  }

  const groups = useMemo(() => groupByDay(rows), [rows]);

  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineHeader}>
        <h2 className={styles.sectionTitle}>Validate timeline</h2>
        <div className={styles.filterRow}>
          {(Object.keys(FILTER_LABEL) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={
                filter === key
                  ? `${styles.chipButton} ${styles.chipButtonActive}`
                  : styles.chipButton
              }
              onClick={() => setFilter(key)}
            >
              {FILTER_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {!isRefetching && groups.length === 0 ? (
        <div className={styles.empty}>No activity yet.</div>
      ) : (
        <div className={styles.timeline}>
          {groups.map((group) => (
            <div key={group.key} className={styles.dayGroup}>
              <div className={styles.dayHeader}>{group.label}</div>
              {group.rows.map((row) => (
                <div key={row.id} className={styles.eventRow}>
                  <span className={dotClass(resultDotTone(row.result))} />
                  <span className={styles.resultLabel}>{row.result}</span>
                  <span
                    className={`${styles.mono} ${styles.time}`}
                    title={formatDate(row.created_at)}
                  >
                    {relativeTime(now, row.created_at)}
                  </span>
                  <span className={`${styles.mono} ${styles.slug}`}>
                    {row.script_slug ?? "-"}
                  </span>
                  <span className={styles.hwid}>
                    <HwidCell hwid={row.hwid} />
                  </span>
                  <span className={`${styles.mono} ${styles.ip}`}>
                    {row.ip ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <div className={styles.loadMoreRow}>
          <button
            type="button"
            className={styles.loadMoreButton}
            disabled={isLoadingMore}
            onClick={handleLoadMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
