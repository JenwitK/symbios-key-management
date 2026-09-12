import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeTone = "ok" | "warn" | "err" | "neutral";

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={styles.badge}>
      <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}
