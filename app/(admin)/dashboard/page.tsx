import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { AdminClient } from "@/lib/require-admin";
import { Sparkline } from "@/components/Sparkline/Sparkline";
import { CountUp } from "@/components/CountUp/CountUp";
import { TrendChart, type TrendChartDay } from "@/components/TrendChart/TrendChart";
import { LiveFeed, type LiveFeedRow } from "@/components/LiveFeed/LiveFeed";
import { expiryCountdown } from "@/lib/datetime";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";

const SERIES_DAYS = 30;
const SPARK_DAYS = 14;
const MISMATCH_ALERT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
type DashboardCounts = {
  active_keys: number;
  expired_keys: number;
  banned_keys: number;
  paused_keys: number;
  total_keys: number;
  customers: number;
  scripts_total: number;
  scripts_maintenance: number;
};

type ExecutionStatsRow = { total_executions: number; unique_devices: number };
type DayRow = { day: string; executions: number; unique_devices: number };
type ResultRow = { result: string; count: number };
type ScriptRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "maintenance";
  keyless: boolean;
};
type ExpiringKeyRow = {
  id: string;
  key_value: string;
  label: string | null;
  discord_id: string | null;
  expires_at: string;
};
type TopScriptRpcRow = { script_id: string; name: string; slug: string; executions: number };

type AttentionItem = {
  tone: "err" | "warn" | "neutral";
  title: string;
  detail: string;
  href: string;
};

type OverviewData = {
  todayExecutions: number | null;
  todayUniqueDevices: number | null;
  yesterdayExecutions: number | null;
  series: TrendChartDay[];
  counts: DashboardCounts | null;
  hwidMismatch24h: number | null;
  serverError24h: number | null;
  unknownScript24h: number | null;
  scripts: ScriptRow[];
  keylessEmptyIds: string[];
  expiringCount: number | null;
  expiringNext3: ExpiringKeyRow[];
  topScripts: (TopScriptRpcRow & { status: "active" | "maintenance" | null })[];
  mostFrequentUnknownSlug: string | null;
  latestServerErrorAt: string | null;
  maintenance: boolean;
  liveFeedRows: LiveFeedRow[];
};

type DeltaInfo =
  | { kind: "chip"; label: string; tone: "ok" | "err" | "neutral" }
  | { kind: "text"; text: string }
  | { kind: "unknown" };

function computeDelta(today: number | null, yesterday: number | null): DeltaInfo {
  if (today === null || yesterday === null) return { kind: "unknown" };
  if (yesterday === 0 && today === 0) return { kind: "text", text: "no executions yet today" };
  if (yesterday === 0) return { kind: "chip", label: "new", tone: today > 0 ? "ok" : "neutral" };
  const pct = Math.round(((today - yesterday) / yesterday) * 1000) / 10;
  const tone: "ok" | "err" | "neutral" = pct > 0 ? "ok" : pct < 0 ? "err" : "neutral";
  return { kind: "chip", label: `${pct > 0 ? "+" : ""}${pct}%`, tone };
}

function bangkokDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

function shortDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTH_LABELS[(month ?? 1) - 1] ?? month}`;
}

function maskKeyValue(value: string): { prefix: string; masked: boolean } {
  const parts = value.split("-");
  if (parts.length < 4) return { prefix: value.slice(0, 4), masked: true };
  return { prefix: `${parts.slice(0, 3).join("-")}-`, masked: true };
}

// Plain data loader, not a component: safe to call `new Date()`/`Date.now()`
// here since this runs once per request rather than during a render pass.
async function loadOverviewData(adminClient: AdminClient): Promise<OverviewData> {
  const now = new Date();
  const todayStart = new Date(`${bangkokDateString(now)}T00:00:00+07:00`);
  const yStart = new Date(todayStart.getTime() - DAY_MS);
  const yEnd = new Date(now.getTime() - DAY_MS);
  const seriesStart = new Date(todayStart.getTime() - (SERIES_DAYS - 1) * DAY_MS);
  const last24h = new Date(now.getTime() - DAY_MS);
  const next7d = new Date(now.getTime() + 7 * DAY_MS);

  const [
    todayStatsResult,
    yStatsResult,
    dayRowsResult,
    countsResult,
    breakdownResult,
    scriptsResult,
    keylessEmptyResult,
    expiringCountResult,
    expiringNext3Result,
    topScriptsResult,
    unknownSlugsResult,
    latestErrorResult,
    settingsResult,
    liveFeedResult,
  ] = await Promise.all([
    adminClient.rpc("execution_stats", {
      from_ts: todayStart.toISOString(),
      to_ts: now.toISOString(),
    }).maybeSingle(),
    adminClient.rpc("execution_stats", {
      from_ts: yStart.toISOString(),
      to_ts: yEnd.toISOString(),
    }).maybeSingle(),
    adminClient.rpc("executions_by_day", {
      from_ts: seriesStart.toISOString(),
      to_ts: now.toISOString(),
    }),
    adminClient.rpc("dashboard_counts").maybeSingle(),
    adminClient.rpc("result_breakdown", {
      from_ts: last24h.toISOString(),
      to_ts: now.toISOString(),
    }),
    adminClient.from("scripts").select("id, name, slug, status, keyless"),
    // Never select `content` on the overview: obfuscated script blobs can be
    // MBs each. This only needs the ids of keyless scripts with no content.
    adminClient
      .from("scripts")
      .select("id")
      .eq("keyless", true)
      .or("content.is.null,content.eq."),
    adminClient
      .from("keys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", next7d.toISOString()),
    adminClient
      .from("keys")
      .select("id, key_value, label, discord_id, expires_at")
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", next7d.toISOString())
      .order("expires_at", { ascending: true })
      .limit(3),
    adminClient.rpc("top_scripts", {
      from_ts: last24h.toISOString(),
      to_ts: now.toISOString(),
      lim: 6,
    }),
    adminClient
      .from("validation_logs")
      .select("script_slug")
      .eq("result", "unknown_script")
      .gte("created_at", last24h.toISOString())
      .limit(1000),
    adminClient
      .from("validation_logs")
      .select("created_at")
      .eq("result", "server_error")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient.from("settings").select("maintenance").eq("id", 1).maybeSingle(),
    adminClient
      .from("validation_logs")
      .select("id, result, script_slug, hwid, ip, created_at, keys(key_value)")
      .order("id", { ascending: false })
      .limit(8),
  ]);

  const dayRows = (dayRowsResult.error ? [] : (dayRowsResult.data ?? [])) as unknown as DayRow[];
  const byDay = new Map(dayRows.map((row) => [row.day, row]));

  const days: string[] = [];
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    days.push(bangkokDateString(new Date(todayStart.getTime() - i * DAY_MS)));
  }
  const series: TrendChartDay[] = days.map((day) => ({
    day,
    executions: byDay.get(day)?.executions ?? 0,
    unique_devices: byDay.get(day)?.unique_devices ?? 0,
  }));

  const todayStats = (
    todayStatsResult.error ? null : todayStatsResult.data
  ) as ExecutionStatsRow | null;
  const yStats = (
    yStatsResult.error ? null : yStatsResult.data
  ) as ExecutionStatsRow | null;

  const breakdownRows = (
    breakdownResult.error ? [] : (breakdownResult.data ?? [])
  ) as unknown as ResultRow[];
  const breakdownMap = new Map(breakdownRows.map((r) => [r.result, r.count]));

  const scripts = (scriptsResult.error ? [] : (scriptsResult.data ?? [])) as unknown as ScriptRow[];
  const scriptStatusById = new Map(scripts.map((s) => [s.id, s.status]));

  const keylessEmptyRows = (
    keylessEmptyResult.error ? [] : (keylessEmptyResult.data ?? [])
  ) as unknown as { id: string }[];
  const keylessEmptyIds = keylessEmptyRows.map((r) => r.id);

  const topScriptsRaw = (
    topScriptsResult.error ? [] : (topScriptsResult.data ?? [])
  ) as unknown as TopScriptRpcRow[];
  const topScripts = topScriptsRaw.map((row) => ({
    ...row,
    status: scriptStatusById.get(row.script_id) ?? null,
  }));

  const unknownSlugRows = (
    unknownSlugsResult.error ? [] : (unknownSlugsResult.data ?? [])
  ) as unknown as { script_slug: string | null }[];
  const slugTally = new Map<string, number>();
  for (const row of unknownSlugRows) {
    if (!row.script_slug) continue;
    slugTally.set(row.script_slug, (slugTally.get(row.script_slug) ?? 0) + 1);
  }
  let mostFrequentUnknownSlug: string | null = null;
  let mostFrequentCount = 0;
  for (const [slug, count] of slugTally) {
    if (count > mostFrequentCount) {
      mostFrequentUnknownSlug = slug;
      mostFrequentCount = count;
    }
  }

  return {
    todayExecutions: todayStats ? Number(todayStats.total_executions) : null,
    todayUniqueDevices: todayStats ? Number(todayStats.unique_devices) : null,
    yesterdayExecutions: yStats ? Number(yStats.total_executions) : null,
    series,
    counts: countsResult.error ? null : (countsResult.data as DashboardCounts | null),
    hwidMismatch24h: breakdownResult.error ? null : Number(breakdownMap.get("hwid_mismatch") ?? 0),
    serverError24h: breakdownResult.error ? null : Number(breakdownMap.get("server_error") ?? 0),
    unknownScript24h: breakdownResult.error ? null : Number(breakdownMap.get("unknown_script") ?? 0),
    scripts,
    keylessEmptyIds,
    expiringCount: expiringCountResult.error ? null : (expiringCountResult.count ?? 0),
    expiringNext3: (
      expiringNext3Result.error ? [] : (expiringNext3Result.data ?? [])
    ) as unknown as ExpiringKeyRow[],
    topScripts,
    mostFrequentUnknownSlug,
    latestServerErrorAt: latestErrorResult.error
      ? null
      : ((latestErrorResult.data?.created_at as string | undefined) ?? null),
    maintenance: settingsResult.error
      ? false
      : ((settingsResult.data?.maintenance as boolean | undefined) ?? false),
    liveFeedRows: (
      liveFeedResult.error ? [] : (liveFeedResult.data ?? [])
    ) as unknown as LiveFeedRow[],
  };
}

export default async function DashboardOverviewPage() {
  const adminClient = createAdminClient();
  const data = await loadOverviewData(adminClient);

  const now = new Date();
  const stampParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const stampPart = (type: string) => stampParts.find((p) => p.type === type)?.value ?? "";
  const nowStamp = `${stampPart("weekday")} ${stampPart("day")} ${stampPart("month")} ${stampPart("year")} · ${stampPart("hour")}:${stampPart("minute")}`;

  const delta = computeDelta(data.todayExecutions, data.yesterdayExecutions);

  const sparkPoints = data.series
    .slice(-SPARK_DAYS)
    .map((d) => ({ label: shortDay(d.day), value: d.executions }));

  const counts = data.counts;
  const activeKeys = counts?.active_keys ?? 0;
  const totalKeys = counts?.total_keys ?? 0;
  const expiredKeys = counts?.expired_keys ?? 0;
  const bannedKeys = counts?.banned_keys ?? 0;
  const pausedKeys = counts?.paused_keys ?? 0;
  const totalKeysForBar = activeKeys + expiredKeys + bannedKeys + pausedKeys;

  const last7Full = data.series.slice(-8, -1);
  const avg7 = last7Full.length > 0
    ? Math.round(last7Full.reduce((sum, d) => sum + d.unique_devices, 0) / last7Full.length)
    : 0;

  const mismatchFill =
    data.hwidMismatch24h === null
      ? 0
      : Math.min(100, Math.round((data.hwidMismatch24h / MISMATCH_ALERT) * 100));

  const activeScriptsCount = data.scripts.filter((s) => s.status === "active").length;
  const maintenanceScripts = data.scripts.filter((s) => s.status === "maintenance");
  const keylessEmptyIdSet = new Set(data.keylessEmptyIds);
  const keylessEmptyScripts = data.scripts.filter((s) => keylessEmptyIdSet.has(s.id));

  function scriptDotTone(script: ScriptRow): "ok" | "warn" | "err" {
    if (keylessEmptyIdSet.has(script.id)) return "err";
    if (script.status === "maintenance") return "warn";
    return "ok";
  }

  const attention: AttentionItem[] = [];

  if (data.maintenance) {
    attention.push({
      tone: "err",
      title: "Maintenance mode is ON",
      detail: "Loader shows UNDER MAINTENANCE for every game.",
      href: "/dashboard/settings",
    });
  }
  if (keylessEmptyScripts.length > 0) {
    attention.push({
      tone: "err",
      title: `${keylessEmptyScripts.length} keyless script(s) empty`,
      detail: keylessEmptyScripts.map((s) => s.name).join(", "),
      href: "/dashboard/scripts",
    });
  }
  if ((data.serverError24h ?? 0) > 0) {
    attention.push({
      tone: "warn",
      title: `${data.serverError24h} server_error in 24h`,
      detail: data.latestServerErrorAt
        ? `Last at ${new Date(data.latestServerErrorAt).toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false })}`
        : "",
      href: "/dashboard/logs?result=server_error",
    });
  }
  if ((data.unknownScript24h ?? 0) > 0) {
    attention.push({
      tone: "warn",
      title: `${data.unknownScript24h} unknown_script in 24h`,
      detail: data.mostFrequentUnknownSlug
        ? `Most frequent slug: ${data.mostFrequentUnknownSlug}`
        : "A game may be missing its script.",
      href: "/dashboard/logs?result=unknown_script",
    });
  }
  if ((data.hwidMismatch24h ?? 0) >= MISMATCH_ALERT) {
    attention.push({
      tone: "warn",
      title: `${data.hwidMismatch24h} HWID mismatches in 24h`,
      detail: "Possible key sharing.",
      href: "/dashboard/logs?result=hwid_mismatch",
    });
  }
  if (maintenanceScripts.length > 0) {
    attention.push({
      tone: "neutral",
      title: `${maintenanceScripts.length} script(s) in maintenance`,
      detail: maintenanceScripts.map((s) => s.name).join(", "),
      href: "/dashboard/scripts",
    });
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <div className={styles.eyebrow}>
            <i /> <span>{nowStamp} ICT</span>
          </div>
          <h1>Overview</h1>
          <p className={styles.pageSub}>Keys, executions, and anything that needs your attention.</p>
        </div>
        <div className={styles.pageActions}>
          <Link href="/dashboard/bulk" className={styles.btn}>
            Bulk
          </Link>
          <Link href="/dashboard/keys?new=1" className={`${styles.btn} ${styles.btnPrimary}`}>
            New key<span className={styles.kbd}>N</span>
          </Link>
        </div>
      </div>

      <div className={styles.sectionHead} style={{ marginTop: 0 }}>
        <span className={styles.idx}>01</span>
        <h2>Pulse</h2>
        <span className={styles.rule} />
        <span className={styles.aside}>today &middot; Asia/Bangkok</span>
      </div>

      <section className={styles.bento}>
        <article className={`${styles.cell} ${styles.hero}`}>
          <div className={styles.cellLabel}>
            <span className={`${styles.dot} ${styles.ok}`} />
            Executions today
            <span className={styles.hint}>14-day trend</span>
          </div>
          {data.todayExecutions === null ? (
            <span className={`${styles.big} ${styles.heroBig}`}>-</span>
          ) : (
            <CountUp value={data.todayExecutions} className={`${styles.big} ${styles.heroBig}`} />
          )}
          <div className={styles.heroMeta}>
            {delta.kind === "chip" ? (
              <>
                <span className={`${styles.chip} ${styles[delta.tone]}`}>{delta.label}</span>
                <span>
                  vs same time yesterday (
                  {data.yesterdayExecutions === null ? "-" : data.yesterdayExecutions.toLocaleString("en-US")}
                  )
                </span>
              </>
            ) : delta.kind === "text" ? (
              <span>{delta.text}</span>
            ) : (
              <span>vs same time yesterday: -</span>
            )}
          </div>
          <Sparkline points={sparkPoints} />
        </article>

        <article className={`${styles.cell} ${styles.wide}`}>
          <div className={styles.cellLabel}>
            <span className={`${styles.dot} ${styles.ok}`} />
            Active keys
            <span className={styles.hint}>
              of {counts ? totalKeys.toLocaleString("en-US") : "-"} total
            </span>
          </div>
          {counts ? (
            <CountUp value={activeKeys} className={styles.big} />
          ) : (
            <span className={styles.big}>-</span>
          )}
          {counts && totalKeysForBar > 0 ? (
            <div className={styles.compBar} aria-label="Key status breakdown">
              <span style={{ flex: Math.max(activeKeys, 0.0001) }} className={styles.compActive} />
              <span style={{ flex: Math.max(expiredKeys, 0.0001) }} className={styles.compExpired} />
              <span style={{ flex: Math.max(bannedKeys, 0.0001) }} className={styles.compBanned} />
              <span style={{ flex: Math.max(pausedKeys, 0.0001) }} className={styles.compPaused} />
            </div>
          ) : null}
          <div className={styles.legend}>
            <div>
              <i className={styles.legendActive} />
              Active <b>{counts ? activeKeys.toLocaleString("en-US") : "-"}</b>
            </div>
            <div>
              <i className={styles.legendExpired} />
              Expired <b>{counts ? expiredKeys.toLocaleString("en-US") : "-"}</b>
            </div>
            <div>
              <i className={styles.legendBanned} />
              Banned <b>{counts ? bannedKeys.toLocaleString("en-US") : "-"}</b>
            </div>
            <div>
              <i className={styles.legendPaused} />
              Paused <b>{counts ? pausedKeys.toLocaleString("en-US") : "-"}</b>
            </div>
          </div>
        </article>

        <article className={styles.cell}>
          <div className={styles.cellLabel}>
            <span className={styles.dot} />
            Unique devices
          </div>
          {data.todayUniqueDevices === null ? (
            <span className={styles.big}>-</span>
          ) : (
            <CountUp value={data.todayUniqueDevices} className={styles.big} />
          )}
          <div className={styles.sub}>
            7-day avg <span className={styles.subNum}>{avg7.toLocaleString("en-US")}</span>
          </div>
        </article>

        <article className={styles.cell}>
          <div className={styles.cellLabel}>
            <span className={`${styles.dot} ${styles.warn}`} />
            HWID mismatches
            <span className={styles.hint}>24h</span>
          </div>
          {data.hwidMismatch24h === null ? (
            <span className={styles.big}>-</span>
          ) : (
            <CountUp value={data.hwidMismatch24h} className={styles.big} />
          )}
          <div className={styles.meter}>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${mismatchFill}%` }} />
              <div className={styles.meterTick} style={{ left: "100%" }} />
            </div>
            <div className={styles.meterScale}>
              <span>0</span>
              <span>attention at {MISMATCH_ALERT}</span>
            </div>
          </div>
        </article>

        <article className={`${styles.cell} ${styles.wide}`}>
          <div className={styles.cellLabel}>
            <span className={styles.dot} />
            Scripts
            <span className={styles.hint}>
              {activeScriptsCount} active &middot; {maintenanceScripts.length} maintenance
            </span>
          </div>
          <CountUp value={data.scripts.length} className={styles.big} />
          <div className={styles.slugRow}>
            {data.scripts.map((script) => (
              <Link
                key={script.id}
                href="/dashboard/scripts"
                className={`${styles.chip} ${styles[scriptDotTone(script)]}`}
              >
                <span className={`${styles.dot} ${styles[scriptDotTone(script)]}`} />
                {script.slug}
              </Link>
            ))}
          </div>
        </article>

        <article className={`${styles.cell} ${styles.wide}`}>
          <div className={styles.cellLabel}>
            <span className={`${styles.dot} ${styles.warn}`} />
            Expiring in 7 days
            <span className={styles.hint}>next 3</span>
          </div>
          {data.expiringCount === null ? (
            <span className={styles.big}>-</span>
          ) : (
            <CountUp value={data.expiringCount} className={styles.big} />
          )}
          {data.expiringNext3.length === 0 ? (
            <div className={styles.expEmpty}>Nothing expiring soon.</div>
          ) : (
            <div className={styles.expList}>
              {data.expiringNext3.map((key) => {
                const { prefix, masked } = maskKeyValue(key.key_value);
                const identity = key.label || key.discord_id || "unlinked";
                const soon = new Date(key.expires_at).getTime() - now.getTime() < DAY_MS;
                return (
                  <Link key={key.id} href={`/dashboard/keys/${key.id}`} className={styles.expRow}>
                    <span className={styles.mono}>{masked ? `${prefix}····` : prefix}</span>
                    <span className={styles.who}>{identity}</span>
                    <span
                      className={soon ? `${styles.when} ${styles.whenSoon}` : styles.when}
                      suppressHydrationWarning
                    >
                      {expiryCountdown(key.expires_at) ?? "-"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <div className={styles.sectionHead}>
        <span className={styles.idx}>02</span>
        <h2>Executions</h2>
        <span className={styles.rule} />
        <span className={styles.aside}>validate calls per day</span>
      </div>

      <TrendChart series={data.series} />

      <div className={styles.sectionHead}>
        <span className={styles.idx}>03</span>
        <h2>Activity</h2>
        <span className={styles.rule} />
        <span className={styles.aside}>streaming from validation_logs</span>
      </div>

      <div className={styles.lower}>
        <LiveFeed
          initialRows={data.liveFeedRows}
          initialLatestId={data.liveFeedRows[0]?.id ?? null}
        />

        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Needs attention</h3>
              <div className={styles.panelAside}>{attention.length} open</div>
            </div>
            {attention.length === 0 ? (
              <div className={styles.attnEmpty}>
                <span className={`${styles.dot} ${styles.ok}`} />
                All clear
              </div>
            ) : (
              <ul className={styles.attn}>
                {attention.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className={
                        item.tone === "err"
                          ? `${styles.attnItem} ${styles.attnErr}`
                          : item.tone === "warn"
                            ? `${styles.attnItem} ${styles.attnWarn}`
                            : styles.attnItem
                      }
                    >
                      <div className={styles.attnBody}>
                        <b>{item.title}</b>
                        {item.detail ? <span>{item.detail}</span> : null}
                      </div>
                      <ChevronRight size={14} strokeWidth={1.6} className={styles.go} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Top scripts</h3>
              <div className={styles.panelAside}>24h</div>
            </div>
            {data.topScripts.length === 0 ? (
              <div className={styles.topEmpty}>No executions in the last 24h.</div>
            ) : (
              <ol className={styles.top}>
                {data.topScripts.map((script, index) => {
                  const max = data.topScripts[0]?.executions || 1;
                  const pct = Math.round((script.executions / max) * 100);
                  const tone: "ok" | "warn" = script.status === "maintenance" ? "warn" : "ok";
                  return (
                    <li key={script.script_id} className={styles.topRow}>
                      <span className={styles.rk}>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <div className={styles.topName}>
                          <span className={`${styles.dot} ${styles[tone]}`} />
                          <span>{script.slug}</span>
                        </div>
                        <div className={styles.topBar}>
                          <i style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className={styles.cnt}>{script.executions.toLocaleString("en-US")}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
