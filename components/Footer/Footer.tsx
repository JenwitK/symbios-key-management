import styles from "./Footer.module.css";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.wordmark}>
          SYM<span className={styles.wordmarkDim}>BIOS</span>
        </span>
        <p className={styles.meta}>
          © {year} SYMBIOS. Not affiliated with Roblox Corporation.
        </p>
      </div>
    </footer>
  );
}
