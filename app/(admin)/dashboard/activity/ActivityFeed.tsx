"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import styles from "./activity.module.css";

export type ActivityRow = {
  id: number;
  result: string;
  script_slug: string | null;
  hwid: string | null;
  ip: string | null;
  created_at: string;
  keys: { key_value: string } | null;
};

type ActivityFeedProps = {
  initialRows: ActivityRow[];
  initialLatestId: number | null;
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

const ERROR_RESULTS = new Set([
  "invalid_key",
  "hwid_mismatch",
  "banned",
  "no_access",
  "expired",
  "server_error",
  "unknown_script",
]);

const INTERVAL_OPTIONS = [
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

const MAX_ROWS = 100;
const NEW_ROW_HIGHLIGHT_MS = 1000;

function maskKey(value: string | null | undefined) {
  if (!value) return "no key";
  return `${value.slice(0, 11)}…${value.slice(-4)}`;
}

function relativeTime(nowMs: number, iso: string) {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d`;
}

function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

export function ActivityFeed({ initialRows, initialLatestId }: ActivityFeedProps) {
  const [rows, setRows] = useState<ActivityRow[]>(initialRows);
  const [latestId, setLatestId] = useState<number | null>(initialLatestId);
  const [live, setLive] = useState(true);
  const [intervalMs, setIntervalMs] = useState(10000);
  const [filter, setFilter] = useState<"all" | "ok" | "errors">("all");
  const [reconnecting, setReconnecting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const latestIdRef = useRef(latestId);
  latestIdRef.current = latestId;
  const liveRef = useRef(live);
  liveRef.current = live;

  async function fetchDelta() {
    try {
      const after = latestIdRef.current;
      const qs = after ? `?after=${after}` : "";
      const res = await fetch(`/api/admin/activity${qs}`, { cache: "no-store" });
      const json: { rows?: ActivityRow[]; latestId?: number | null; error?: string } =
        await res.json();

      if (!res.ok) {
        setReconnecting(true);
        return;
      }

      setReconnecting(false);

      const incoming = json.rows ?? [];
      if (incoming.length === 0) return;

      setRows((current) => {
        const seen = new Set(current.map((row) => row.id));
        const fresh = incoming.filter((row) => !seen.has(row.id));
        if (fresh.length === 0) return current;
        return [...fresh, ...current].slice(0, MAX_ROWS);
      });

      const incomingIds = incoming.map((row) => row.id);
      setNewIds((current) => new Set([...current, ...incomingIds]));
      setTimeout(() => {
        setNewIds((current) => {
          const next = new Set(current);
          for (const id of incomingIds) next.delete(id);
          return next;
        });
      }, NEW_ROW_HIGHLIGHT_MS);

      if (json.latestId != null) {
        const nextLatest = json.latestId;
        setLatestId((current) => (current == null ? nextLatest : Math.max(current, nextLatest)));
      }
    } catch {
      setReconnecting(true);
    }
  }

  useEffect(() => {
    const pollId = setInterval(() => {
      if (liveRef.current && document.visibilityState === "visible") {
        fetchDelta();
      }
    }, intervalMs);

    const tickId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    function handleVisibility() {
      const isHidden = document.visibilityState === "hidden";
      setHidden(isHidden);
      if (!isHidden) {
        fetchDelta();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "ok") return rows.filter((row) => row.result === "ok");
    return rows.filter((row) => ERROR_RESULTS.has(row.result));
  }, [rows, filter]);

  const stats = useMemo(() => {
    const last60 = rows.filter(
      (row) => now - new Date(row.created_at).getTime() <= 60000,
    ).length;
    const ok = rows.filter((row) => row.result === "ok").length;
    const okRate = rows.length > 0 ? Math.round((ok / rows.length) * 100) : 0;
    const mismatch = rows.filter((row) => row.result === "hwid_mismatch").length;
    const uniqHwid = new Set(rows.map((row) => row.hwid).filter(Boolean)).size;
    const uniqIp = new Set(rows.map((row) => row.ip).filter(Boolean)).size;
    return { last60, okRate, mismatch, uniqHwid, uniqIp };
  }, [rows, now]);

  return (
    <div className={styles.stack}>
      <div className={styles.controls}>
        <div className={styles.liveIndicator}>
          <span className={live ? `${styles.dot} ${styles.dotLive}` : styles.dot} />
          <span>{live ? "live" : "paused"}</span>
          {hidden ? <span className={styles.hint}>paused (tab hidden)</span> : null}
          {reconnecting ? <span className={styles.hint}>reconnecting</span> : null}
        </div>

        <div className={styles.controlActions}>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => setLive((current) => !current)}
          >
            {live ? "Pause" : "Resume"}
          </button>

          <select
            value={intervalMs}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
            className={styles.select}
            aria-label="Refresh interval"
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.controlButton}
            onClick={() => fetchDelta()}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.statStrip}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Events/60s</span>
          <span className={styles.statValue}>{stats.last60}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>OK rate</span>
          <span className={styles.statValue}>{stats.okRate}%</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Mismatch</span>
          <span className={styles.statValue}>{stats.mismatch}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Uniq HWID</span>
          <span className={styles.statValue}>{stats.uniqHwid}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Uniq IP</span>
          <span className={styles.statValue}>{stats.uniqIp}</span>
        </div>
      </div>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={filter === "all" ? `${styles.chip} ${styles.chipActive}` : styles.chip}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filter === "ok" ? `${styles.chip} ${styles.chipActive}` : styles.chip}
          onClick={() => setFilter("ok")}
        >
          OK
        </button>
        <button
          type="button"
          className={filter === "errors" ? `${styles.chip} ${styles.chipActive}` : styles.chip}
          onClick={() => setFilter("errors")}
        >
          Errors
        </button>
      </div>

      <div className={styles.feedWrap} aria-live="polite">
        {filteredRows.length === 0 ? (
          <div className={styles.empty}>No activity yet.</div>
        ) : (
          <div className={styles.feed}>
            {filteredRows.map((row) => (
              <div
                key={row.id}
                className={
                  newIds.has(row.id) ? `${styles.row} ${styles.rowEnter}` : styles.row
                }
              >
                <span
                  className={`${styles.mono} ${styles.time}`}
                  title={fullTime(row.created_at)}
                >
                  {relativeTime(now, row.created_at)}
                </span>
                <Badge tone={RESULT_TONE[row.result] ?? "neutral"}>{row.result}</Badge>
                <span className={`${styles.mono} ${styles.slug}`}>
                  {row.script_slug ?? "-"}
                </span>
                <span className={`${styles.mono} ${styles.key}`}>
                  {maskKey(row.keys?.key_value)}
                </span>
                <span className={styles.hwid}>
                  <HwidCell hwid={row.hwid} />
                </span>
                <span className={`${styles.mono} ${styles.ip}`}>{row.ip ?? "-"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
