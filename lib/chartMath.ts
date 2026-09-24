// Shared SVG chart math: monotone cubic interpolation (no overshoot) and a
// "nice" axis max, ported from the UI v2 mockup's vanilla JS.

export type Point = [number, number];

/** Cubic bezier segments (SVG path "C..." commands) connecting each pair of points. */
export function monotoneSegments(points: Point[]): string[] {
  const n = points.length;
  const dx: number[] = [];
  const m: number[] = [];
  const t: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    m.push((points[i + 1][1] - points[i][1]) / dx[i]);
  }

  t.push(m[0]);
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t.push(0);
    } else {
      const c = dx[i - 1] + dx[i];
      t.push((3 * c) / ((c + dx[i]) / m[i - 1] + (c + dx[i - 1]) / m[i]));
    }
  }
  t.push(m[n - 2]);

  const segs: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    segs.push(`C${x0 + h},${y0 + t[i] * h} ${x1 - h},${y1 - t[i + 1] * h} ${x1},${y1}`);
  }
  return segs;
}

/** Rounds a positive value up to a clean axis max (1/2/2.5/5/10 x 10^n). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / p;
  const mult = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return mult * p;
}

export function formatCompact1k(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1000) {
    const thousands = rounded / 1000;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `${rounded}`;
}
