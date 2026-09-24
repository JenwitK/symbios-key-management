import { monotoneSegments, type Point } from "@/lib/chartMath";
import styles from "./Sparkline.module.css";

export type SparklinePoint = {
  label: string;
  value: number;
};

type SparklineProps = {
  points: SparklinePoint[];
  height?: number;
};

const VIEWBOX_WIDTH = 300;
const SIDE_PAD = 20;

/** Server-rendered (no client JS): the hero sparkline never needs interactivity. */
export function Sparkline({ points, height = 118 }: SparklineProps) {
  if (points.length < 2) {
    return <div className={styles.spark} style={{ height }} />;
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values) * 1.12 || 1;
  const innerWidth = VIEWBOX_WIDTH - SIDE_PAD;

  const pts: Point[] = points.map((p, i) => [
    (i / (points.length - 1)) * innerWidth,
    height - 22 - (p.value / max) * (height - 34),
  ]);

  const segs = monotoneSegments(pts);
  const line = `M${pts[0][0]},${pts[0][1]}${segs.slice(0, -1).join("")}`;
  const last = `M${pts[pts.length - 2][0]},${pts[pts.length - 2][1]}${segs[segs.length - 1]}`;
  const area = `M${pts[0][0]},${pts[0][1]}${segs.join("")}L${pts[pts.length - 1][0]},${height}L0,${height}Z`;
  const [lastX, lastY] = pts[pts.length - 1];
  // `preserveAspectRatio="none"` scales x and y independently, which would
  // squash an SVG <circle> into an ellipse; render the end dot as plain HTML
  // instead so it stays round. Horizontal position is a percent (matches the
  // svg's stretch to 100% width); vertical is a px offset (height is fixed).
  const dotLeftPct = (lastX / VIEWBOX_WIDTH) * 100;

  return (
    <div className={styles.spark} style={{ height }}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkGradient)" />
        <path d={line} fill="none" className={styles.line} />
        <path d={last} fill="none" className={styles.lastSegment} />
      </svg>
      <span className={styles.haloDot} style={{ left: `${dotLeftPct}%`, top: lastY }} />
      <span className={styles.dot} style={{ left: `${dotLeftPct}%`, top: lastY }} />
      <div className={styles.labels}>
        <span>{points[0].label}</span>
        <span>today, partial</span>
      </div>
    </div>
  );
}
