"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { monotoneSegments, niceMax, formatCompact1k, type Point } from "@/lib/chartMath";
import styles from "./TrendChart.module.css";

export type TrendChartDay = {
  day: string;
  executions: number;
  unique_devices: number;
};

type TrendChartProps = {
  series: TrendChartDay[];
};

type Metric = "executions" | "devices";
type Range = 7 | 14 | 30;

const INITIAL_WIDTH = 800;
const HEIGHT = 250;
const PAD = { l: 40, r: 14, t: 16, b: 30 };
const LABEL_PX_PER_TICK = 52;
const TOOLTIP_WIDTH = 150;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTH_LABELS[(month ?? 1) - 1] ?? month}`;
}

function fullDay(day: string): string {
  const d = new Date(`${day}T00:00:00+07:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "executions", label: "Executions" },
  { value: "devices", label: "Devices" },
];

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
];

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(`[data-seg="${value}"]`);
    if (btn) {
      setThumb({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value, options]);

  return (
    <div className={styles.seg} ref={containerRef}>
      {thumb ? (
        <span className={styles.segThumb} style={{ left: thumb.left, width: thumb.width }} />
      ) : null}
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          data-seg={opt.value}
          className={opt.value === value ? `${styles.segButton} ${styles.segButtonOn}` : styles.segButton}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function TrendChart({ series }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>("executions");
  const [range, setRange] = useState<Range>(14);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(INITIAL_WIDTH);
  const [firstPaintDone, setFirstPaintDone] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = containerWidth > 0 ? containerWidth : INITIAL_WIDTH;

  useEffect(() => {
    const id = requestAnimationFrame(() => setFirstPaintDone(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(() => series.slice(-range), [series, range]);
  const days = useMemo(() => visible.map((d) => d.day), [visible]);
  const values = useMemo(
    () => visible.map((d) => (metric === "executions" ? d.executions : d.unique_devices)),
    [visible, metric],
  );
  const otherValues = useMemo(
    () => visible.map((d) => (metric === "executions" ? d.unique_devices : d.executions)),
    [visible, metric],
  );

  const n = visible.length;

  const total = values.reduce((sum, v) => sum + v, 0);
  const fullDayValues = values.slice(0, -1);
  const dailyAvg =
    fullDayValues.length > 0
      ? Math.round(fullDayValues.reduce((sum, v) => sum + v, 0) / fullDayValues.length)
      : 0;

  let peakValue = 0;
  let peakDayIndex = 0;
  values.forEach((v, i) => {
    if (v >= peakValue) {
      peakValue = v;
      peakDayIndex = i;
    }
  });

  const maxValue = niceMax(Math.max(...values, 1) * 1.05);
  const innerWidth = width - PAD.l - PAD.r;
  const innerHeight = HEIGHT - PAD.t - PAD.b;
  const stepX = n > 1 ? innerWidth / (n - 1) : 0;

  function xAt(i: number) {
    return PAD.l + stepX * i;
  }
  function yAt(v: number) {
    return PAD.t + (1 - v / maxValue) * innerHeight;
  }

  const pts: Point[] = values.map((v, i) => [xAt(i), yAt(v)]);
  const segs = n > 1 ? monotoneSegments(pts) : [];
  const linePath = n > 1 ? `M${pts[0][0]},${pts[0][1]}${segs.slice(0, -1).join("")}` : "";
  const lastSegPath = n > 1 ? `M${pts[n - 2][0]},${pts[n - 2][1]}${segs[n - 2]}` : "";
  const areaPath =
    n > 1
      ? `M${pts[0][0]},${pts[0][1]}${segs.join("")}L${pts[n - 1][0]},${HEIGHT - PAD.b}L${PAD.l},${HEIGHT - PAD.b}Z`
      : "";

  const gridLines = [0, 1, 2, 3, 4].map((k) => (maxValue / 4) * k);

  const every = Math.max(1, Math.ceil((n * LABEL_PX_PER_TICK) / Math.max(1, innerWidth)));
  const xLabels = days
    .map((day, i) => {
      if ((n - 1 - i) % every !== 0) return null;
      return { i, x: xAt(i), label: i === n - 1 ? "Today" : shortDay(day) };
    })
    .filter((v): v is { i: number; x: number; label: string } => v !== null);

  // viewBox width matches the svg's actual rendered width 1:1 (no
  // preserveAspectRatio scaling), so pointer x maps directly with no scale
  // factor, using the svg's own rect rather than the padded wrapper's.
  function indexFromPointer(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg || n === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const localX = clientX - rect.left;
    const rawIndex = stepX > 0 ? (localX - PAD.l) / stepX : 0;
    return Math.min(n - 1, Math.max(0, Math.round(rawIndex)));
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const index = indexFromPointer(event.clientX);
    if (index !== null) setHoverIndex(index);
  }

  function handlePointerLeave() {
    setHoverIndex(null);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setHoverIndex((current) => Math.max(0, (current ?? n) - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setHoverIndex((current) => Math.min(n - 1, (current ?? -1) + 1));
    } else if (event.key === "Escape") {
      setHoverIndex(null);
    }
  }

  const hoverLeftPx = hoverIndex !== null ? xAt(hoverIndex) : 0;
  const flip = hoverIndex !== null && hoverLeftPx > width - TOOLTIP_WIDTH - 10;

  return (
    <div className={styles.panel}>
      <div className={styles.chartHead}>
        <div className={styles.stat}>
          <small>Total</small>
          <b>{total.toLocaleString("en-US")}</b>
          <span>{range}d</span>
        </div>
        <div className={styles.stat}>
          <small>Daily avg</small>
          <b>{dailyAvg.toLocaleString("en-US")}</b>
          <span>full days</span>
        </div>
        <div className={styles.stat}>
          <small>Peak</small>
          <b>{peakValue.toLocaleString("en-US")}</b>
          <span>{days[peakDayIndex] ? shortDay(days[peakDayIndex]) : ""}</span>
        </div>
        <div className={styles.chartControls}>
          <SegmentedControl options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>
      </div>

      <div
        ref={wrapRef}
        className={firstPaintDone ? `${styles.chartWrap} ${styles.revealed}` : styles.chartWrap}
      >
        <svg
          ref={svgRef}
          key={`${metric}-${range}`}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`${metric === "executions" ? "Executions" : "Unique devices"} per day`}
          className={styles.svg}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <defs>
            <linearGradient id="trendChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
              <stop offset="0.7" stopColor="#fff" stopOpacity="0.02" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((v, k) => {
            const y = yAt(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.l}
                  x2={width - PAD.r}
                  y1={y}
                  y2={y}
                  className={k === 0 ? styles.gridLineSolid : styles.gridLineDashed}
                />
                <text x={PAD.l - 10} y={y + 3.5} textAnchor="end" className={styles.yLabel}>
                  {formatCompact1k(v)}
                </text>
              </g>
            );
          })}

          {xLabels.map(({ i, x, label }) => (
            <text
              key={i}
              x={x}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className={i === n - 1 ? styles.xLabelActive : styles.xLabel}
            >
              {label}
            </text>
          ))}

          {areaPath ? <path d={areaPath} fill="url(#trendChartGradient)" /> : null}
          {linePath ? <path d={linePath} fill="none" className={styles.line} /> : null}
          {lastSegPath ? <path d={lastSegPath} fill="none" className={styles.lastSegment} /> : null}

          {hoverIndex !== null ? (
            <>
              <line
                x1={xAt(hoverIndex)}
                x2={xAt(hoverIndex)}
                y1={PAD.t}
                y2={HEIGHT - PAD.b}
                className={styles.guideLine}
              />
              <circle cx={xAt(hoverIndex)} cy={yAt(values[hoverIndex])} r={3} className={styles.hoverDot} />
            </>
          ) : null}

          <rect
            x={PAD.l}
            y={PAD.t}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </svg>

        {hoverIndex !== null ? (
          <div
            className={flip ? `${styles.tip} ${styles.tipShow} ${styles.tipFlip}` : `${styles.tip} ${styles.tipShow}`}
            style={{ left: hoverLeftPx }}
          >
            <div className={styles.tDate}>
              {days[hoverIndex] ? fullDay(days[hoverIndex]) : ""}
              {hoverIndex === n - 1 ? " (partial)" : ""}
            </div>
            <div className={styles.tRow}>
              <span className={`${styles.sw} ${styles.swExec}`} />
              Executions
              <b>{(metric === "executions" ? values[hoverIndex] : otherValues[hoverIndex]).toLocaleString("en-US")}</b>
            </div>
            <div className={styles.tRow}>
              <span className={`${styles.sw} ${styles.swDev}`} />
              Devices
              <b>{(metric === "devices" ? values[hoverIndex] : otherValues[hoverIndex]).toLocaleString("en-US")}</b>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
