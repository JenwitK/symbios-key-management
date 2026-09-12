import styles from "./LoadingState.module.css";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className={styles.loading}>{label}</p>;
}
