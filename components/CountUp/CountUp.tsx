"use client";

import { useEffect, useState } from "react";

type CountUpProps = {
  value: number;
  className?: string;
};

const DURATION_MS = 1000;

/**
 * Server renders the final value; only the very first client mount animates
 * up from 0. Later value changes (router refresh, a toggle elsewhere on the
 * page) show immediately instead of re-animating.
 */
export function CountUp({ value, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [animated, setAnimated] = useState(false);

  // Adjust state during render (React's sanctioned pattern for syncing state
  // to a changed prop) rather than in an effect, once the first animation
  // has already run.
  if (animated && value !== prevValue) {
    setPrevValue(value);
    setDisplay(value);
  }

  useEffect(() => {
    if (animated) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Still needs to flip `animated` (deferred into a callback, not the
      // synchronous effect body) so later value changes snap immediately.
      const id = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(id);
    }

    const start = performance.now();
    let frame: number;

    function step(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        setAnimated(true);
      }
    }

    // The reset to 0 is deferred into the first animation frame callback
    // (not called synchronously in the effect body) to avoid cascading renders.
    frame = requestAnimationFrame(() => {
      setDisplay(0);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [animated, value]);

  return <span className={className}>{display.toLocaleString("en-US")}</span>;
}
