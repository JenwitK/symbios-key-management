import { Badge } from "@/components/Badge/Badge";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import styles from "./analytics.module.css";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 180;
const RANGE_DAYS = 30;

type DayRow = {
  day: string;
  executions: number;
  unique_devices: number;
};

type TopScriptRow = {
  script_id: string;
  name: string;
  slug: string;
  executions: number;
};

type ResultRow = {
  result: string;
  count: number;
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

function formatTick(day: string) {
  const parts = day.split("-");
  const month = parts[1] ?? "";
  const date = parts[2] ?? "";
  return `${Number(month)}/${Number(date)}`;
}

function buildAreaChart(values: number[]) {
  const paddingX = 12;
  const paddingTop = 12;
  const paddingBottom = 22;
  const innerWidth = CHART_WIDTH - paddingX * 2;
  const innerHeight = CHART_HEIGHT - paddingTop - paddingBottom;
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  const points = values.map((value, i) => ({
    x: paddingX + stepX * i,
    y: paddingTop + innerHeight - (value / max) * innerHeight,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const baselineY = paddingTop + innerHeight;
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${baselineY} L${points[0].x.toFixed(1)},${baselineY} Z`
      : "";

  return { linePath, areaPath, points, baselineY, paddingX };
}

export default async function AnalyticsPage() {
  const now = new Date();
  const from = new Date(now.getTime() - RANGE_DAYS * 24 * 60 * 60 * 1000);
  const fromTs = from.toISOString();
  const toTs = now.toISOString();

  const adminClient = createAdminClient();

  const [dayResult, statsResult, topResult, breakdownResult] =
    await Promise.all([
      adminClient.rpc("executions_by_day", { from_ts: fromTs, to_ts: toTs }),
      adminClient.rpc("execution_stats", { from_ts: fromTs, to_ts: toTs }),
      adminClient.rpc("top_scripts", { from_ts: fromTs, to_ts: toTs, lim: 8 }),
      adminClient.rpc("result_breakdown", { from_ts: fromTs, to_ts: toTs }),
    ]);

  const dayRows = (
    dayResult.error ? [] : (dayResult.data ?? [])
  ) as unknown as DayRow[];
  const statsRow = (
    statsResult.error ? null : statsResult.data?.[0]
  ) as { total_executions: number; unique_devices: number } | null;
  const topRows = (
    topResult.error ? [] : (topResult.data ?? [])
  ) as unknown as TopScriptRow[];
  const breakdownRows = (
    breakdownResult.error ? [] : (breakdownResult.data ?? [])
  ) as unknown as ResultRow[];

  const days: string[] = [];
  for (let i = RANGE_DAYS - 1; i >= 0; i--) {
    days.push(bangkokDateString(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }

  const byDay = new Map(dayRows.map((row) => [row.day, row]));
  const series = days.map((day) => ({
    day,
    executions: byDay.get(day)?.executions ?? 0,
  }));

  const totalExecutions = statsRow?.total_executions ?? 0;
  const uniqueDevices = statsRow?.unique_devices ?? 0;
  const activeDays = series.filter((d) => d.executions > 0).length;

  const stats = [
    { label: "Executions (30d)", value: totalExecutions, tone: "ok" as const },
    {
      label: "Unique devices (30d)",
      value: uniqueDevices,
      tone: "neutral" as const,
    },
    { label: "Active days (30d)", value: activeDays, tone: "neutral" as const },
  ];

  const chart = buildAreaChart(series.map((d) => d.executions));

  const tickCount = Math.min(5, series.length);
  const tickIndices = Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, i) =>
        Math.round(((series.length - 1) * i) / (tickCount - 1)),
      ),
    ),
  );

  const topMax = Math.max(1, ...topRows.map((r) => r.executions));
  const breakdownMax = Math.max(1, ...breakdownRows.map((r) => r.count));

  return (
    <div>
      <h1 className={styles.pageTitle}>Analytics</h1>
      <p className={styles.pageSubtitle}>Last 30 days.</p>

      <div className={styles.statGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <span className={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Executions per day</h2>
        <div className={styles.chartCard}>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Executions per day, last 30 days"
            className={styles.chart}
          >
            <line
              x1={chart.paddingX}
              y1={chart.baselineY}
              x2={CHART_WIDTH - chart.paddingX}
              y2={chart.baselineY}
              className={styles.chartBaseline}
            />
            {chart.areaPath ? (
              <path d={chart.areaPath} className={styles.chartArea} />
            ) : null}
            {chart.linePath ? (
              <path d={chart.linePath} className={styles.chartLine} />
            ) : null}
            {tickIndices.map((i) => {
              const point = chart.points[i];
              if (!point) return null;
              return (
                <text
                  key={i}
                  x={point.x}
                  y={CHART_HEIGHT - 4}
                  textAnchor="middle"
                  className={styles.chartTick}
                >
                  {formatTick(series[i].day)}
                </text>
              );
            })}
          </svg>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top games</h2>
        {topRows.length === 0 ? (
          <div className={styles.empty}>No executions in this range yet.</div>
        ) : (
          <div className={styles.barList}>
            {topRows.map((script, i) => (
              <div key={script.script_id} className={styles.barRow}>
                <span className={styles.rankIndex}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.barLabel}>
                  {script.name}{" "}
                  <span className={styles.barLabelSlug}>{script.slug}</span>
                </span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(script.executions / topMax) * 100}%`,
                    }}
                  />
                </div>
                <span className={styles.barValue}>{script.executions}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Results breakdown</h2>
        {breakdownRows.length === 0 ? (
          <div className={styles.empty}>No validation attempts logged yet.</div>
        ) : (
          <div className={styles.barList}>
            {breakdownRows.map((row) => (
              <div key={row.result} className={styles.barRow}>
                <span className={styles.barLabel}>
                  <Badge tone={RESULT_TONE[row.result] ?? "neutral"}>
                    {row.result}
                  </Badge>
                </span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(row.count / breakdownMax) * 100}%` }}
                  />
                </div>
                <span className={styles.barValue}>{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
