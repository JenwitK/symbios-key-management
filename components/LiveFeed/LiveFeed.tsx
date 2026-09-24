"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSyncActions } from "@/components/Sync/SyncProvider";
import styles from "./LiveFeed.module.css";

export type LiveFeedRow = {
  id: number;
  result: string;
  script_slug: string | null;
  hwid: string | null;
  ip: string | null;
  created_at: string;
  keys: { key_value: string } | null;
};

type LiveFeedProps = {
  initialRows: LiveFeedRow[];
  initialLatestId: number | null;
};

const POLL_MS = 5000;
const MAX_ROWS = 40;
const SHOWN_ROWS = 8;
const NEW_ROW_HIGHLIGHT_MS = 1000;

const RESULT_TONE: Record<string, "ok" | "warn" | "err" | "neutral"> = {
  ok: "ok",
  key_required: "neutral",
  invalid_key: "err",
  banned: "err",
  hwid_mismatch: "warn",
  paused: "warn",
  expired: "neutral",
  no_access: "err",
  unknown_script: "warn",
  server_error: "err",
};

function maskKeyValue(value: string | null | undefined): { prefix: string; masked: boolean } {
  if (!value) return { prefix: "", masked: false };
  const parts = value.split("-");
  if (parts.length < 4) return { prefix: value.slice(0, 4), masked: true };
  return { prefix: `${parts.slice(0, 3).join("-")}-`, masked: true };
}

function relativeTime(nowMs: number, iso: string): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  return `${Math.floor(diffHour / 24)}d`;
}

export function LiveFeed({ initialRows, initialLatestId }: LiveFeedProps) {
  const [rows, setRows] = useState<LiveFeedRow[]>(initialRows);
  const [latestId, setLatestId] = useState<number | null>(initialLatestId);
  const [filter, setFilter] = useState<"all" | "ok" | "errors">("all");
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const { setLive, markSynced } = useSyncActions();
  const latestIdRef = useRef(latestId);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestIdRef.current = latestId;
  }, [latestId]);

  const fetchDelta = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const after = latestIdRef.current;
      const qs = after ? `?after=${after}&limit=50` : "?limit=50";
      const res = await fetch(`/api/admin/activity${qs}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json: { rows?: LiveFeedRow[]; latestId?: number | null; error?: string } =
        await res.json();

      if (!res.ok) {
        setReconnecting(true);
        return;
      }

      setReconnecting(false);
      markSynced();

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
      if (!controller.signal.aborted) setReconnecting(true);
    }
  }, [markSynced]);

  useEffect(() => {
    let pollId: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      setLive(true);
      if (pollId) return;
      pollId = setInterval(() => {
        if (document.visibilityState === "visible") fetchDelta();
      }, POLL_MS);
    }

    function stopPolling() {
      setLive(false);
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        startPolling();
        fetchDelta();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    const tickId = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(tickId);
      abortRef.current?.abort();
    };
  }, [fetchDelta, setLive]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "ok") return rows.filter((row) => row.result === "ok");
    return rows.filter((row) => row.result !== "ok");
  }, [rows, filter]);

  const shownRows = filteredRows.slice(0, SHOWN_ROWS);

  const eventsPerMinute = useMemo(
    () => rows.filter((row) => now - new Date(row.created_at).getTime() <= 60000).length,
    [rows, now],
  );

  const okRate = useMemo(() => {
    if (rows.length === 0) return null;
    const ok = rows.filter((row) => row.result === "ok").length;
    return Math.round((ok / rows.length) * 1000) / 10;
  }, [rows]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>Live validations</h3>
        <div className={styles.filters}>
          <button
            type="button"
            className={filter === "all" ? `${styles.filterBtn} ${styles.filterOn}` : styles.filterBtn}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filter === "ok" ? `${styles.filterBtn} ${styles.filterOn}` : styles.filterBtn}
            onClick={() => setFilter("ok")}
          >
            OK
          </button>
          <button
            type="button"
            className={filter === "errors" ? `${styles.filterBtn} ${styles.filterOn}` : styles.filterBtn}
            onClick={() => setFilter("errors")}
          >
            Errors
          </button>
        </div>
        <div className={styles.aside}>
          <span className={styles.liveDot} />
          {reconnecting ? "Reconnecting" : `${eventsPerMinute}/min`}
        </div>
      </div>

      <ul className={styles.feed}>
        {shownRows.length === 0 ? (
          <li className={styles.feedRow}>
            <span className={styles.res}>No events for this filter yet.</span>
          </li>
        ) : (
          shownRows.map((row) => {
            const tone = RESULT_TONE[row.result] ?? "neutral";
            const { prefix, masked } = maskKeyValue(row.keys?.key_value);
            return (
              <li
                key={row.id}
                className={newIds.has(row.id) ? `${styles.feedRow} ${styles.enter}` : styles.feedRow}
              >
                <span className={styles.res}>
                  <span className={`${styles.dot} ${styles[tone]}`} />
                  {row.result}
                </span>
                <span className={styles.slug}>{row.script_slug ?? "-"}</span>
                <span className={styles.keyMask}>
                  {masked ? (
                    <>
                      {prefix}
                      <em>····</em>
                    </>
                  ) : (
                    <em>no key sent</em>
                  )}
                </span>
                <span className={styles.ago} title={row.created_at} suppressHydrationWarning>
                  {relativeTime(now, row.created_at)}
                </span>
              </li>
            );
          })
        )}
      </ul>

      <div className={styles.feedFoot}>
        <span>
          {okRate === null ? "No events yet" : `OK rate ${okRate}% · last ${rows.length} events`}
        </span>
        <Link href="/dashboard/activity" className={styles.link}>
          Open Activity
        </Link>
      </div>
    </section>
  );
}
