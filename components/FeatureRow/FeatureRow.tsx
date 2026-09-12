import styles from "./FeatureRow.module.css";

type FeatureRowProps = {
  index: string;
  title: string;
  description: string;
  align?: "start" | "end";
};

export function FeatureRow({
  index,
  title,
  description,
  align = "start",
}: FeatureRowProps) {
  const rowClass =
    align === "end" ? `${styles.row} ${styles.reversed}` : styles.row;

  return (
    <div className={rowClass}>
      <div className={styles.label}>
        <span className={styles.index}>{index}</span>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
