"use client";

import { useRef, useState, type PointerEvent } from "react";
import styles from "./AreaChart.module.css";

export type AreaChartPoint = {
  label: string;
  value: number;
};

type AreaChartProps = {
  points: AreaChartPoint[];
  height?: number;
  ariaLabel?: string;
};

const VIEWBOX_WIDTH = 720;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const TOOLTIP_HALF_WIDTH = 64;
const TOOLTIP_FLIP_THRESHOLD = 60;

type HoverState = {
  index: number;
  leftPx: number;
  topPx: number;
  showBelow: boolean;
};

function computeNiceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  if (rawMax <= 5) return 5;
  const exponent = Math.floor(Math.log10(rawMax));
  const base = 10 ** exponent;
  const normalized = rawMax / base;
  let step: number;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  return step * base;
}

function formatCompact(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1000) {
    const thousands = rounded / 1000;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `${rounded}`;
}

export function AreaChart({ points, height = 160, ariaLabel }: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const innerWidth = VIEWBOX_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = height - PAD_TOP - PAD_BOTTOM;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const rawMax = Math.max(0, ...points.map((p) => p.value));
  const maxValue = computeNiceMax(rawMax);
  const baselineY = PAD_TOP + innerHeight;

  function xAt(index: number) {
    return PAD_LEFT + stepX * index;
  }

  function yAt(value: number) {
    return PAD_TOP + innerHeight - (value / maxValue) * innerHeight;
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L${xAt(points.length - 1).toFixed(1)},${baselineY} L${xAt(0).toFixed(1)},${baselineY} Z`
      : "";

  const gridValues = [0, 1, 2, 3].map((i) => (maxValue * i) / 3);

  const tickCount = Math.min(5, points.length);
  const tickIndices =
    tickCount <= 1
      ? points.length > 0
        ? [0]
        : []
      : Array.from(
          new Set(
            Array.from({ length: tickCount }, (_, i) =>
              Math.round(((points.length - 1) * i) / (tickCount - 1)),
            ),
          ),
        );

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    const pixelToViewBox = VIEWBOX_WIDTH / rect.width;
    const viewBoxToPixel = rect.width / VIEWBOX_WIDTH;
    const pointerX = event.clientX - rect.left;
    const vbX = pointerX * pixelToViewBox;
    const rawIndex = stepX > 0 ? (vbX - PAD_LEFT) / stepX : 0;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round(rawIndex)),
    );

    const leftPx = xAt(index) * viewBoxToPixel;
    const topPx = yAt(points[index].value) * viewBoxToPixel;
    const clampedLeft = Math.min(
      Math.max(leftPx, TOOLTIP_HALF_WIDTH),
      Math.max(rect.width - TOOLTIP_HALF_WIDTH, TOOLTIP_HALF_WIDTH),
    );

    setHover({
      index,
      leftPx: clampedLeft,
      topPx,
      showBelow: topPx < TOOLTIP_FLIP_THRESHOLD,
    });
  }

  function handlePointerLeave() {
    setHover(null);
  }

  const hoveredPoint = hover ? points[hover.index] : null;

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className={styles.svg}
      >
        <g aria-hidden="true">
          {gridValues.map((value) => {
            const y = yAt(value);
            return (
              <g key={value}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={VIEWBOX_WIDTH - PAD_RIGHT}
                  y2={y}
                  className={styles.gridLine}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y}
                  dy="0.32em"
                  textAnchor="end"
                  className={styles.yLabel}
                >
                  {formatCompact(value)}
                </text>
              </g>
            );
          })}

          {areaPath ? <path d={areaPath} className={styles.area} /> : null}
          {linePath ? <path d={linePath} className={styles.line} /> : null}

          {tickIndices.map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 6}
              textAnchor="middle"
              className={styles.xTick}
            >
              {points[i].label}
            </text>
          ))}

          {hover ? (
            <>
              <line
                x1={xAt(hover.index)}
                y1={PAD_TOP}
                x2={xAt(hover.index)}
                y2={baselineY}
                className={styles.guideLine}
              />
              <circle
                cx={xAt(hover.index)}
                cy={yAt(points[hover.index].value)}
                r={3}
                className={styles.hoverDot}
              />
            </>
          ) : null}
        </g>

        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={innerWidth}
          height={innerHeight}
          className={styles.overlay}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
      </svg>

      {hover && hoveredPoint ? (
        <div
          className={styles.tooltip}
          style={{
            left: hover.leftPx,
            top: hover.showBelow ? hover.topPx + 14 : hover.topPx - 14,
            transform: hover.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <div className={styles.tooltipValue}>{hoveredPoint.value}</div>
          <div className={styles.tooltipLabel}>{hoveredPoint.label}</div>
        </div>
      ) : null}
    </div>
  );
}
