import Link from "next/link";
import { KeyRound } from "lucide-react";
import styles from "./Navbar.module.css";

export function Navbar() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <KeyRound size={14} strokeWidth={2.25} />
          </span>
          <span className={styles.wordmark}>
            SYM<span className={styles.wordmarkDim}>BIOS</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <Link href="/docs" className={styles.navLink}>
            Docs
          </Link>
          <Link href="/panel" className={styles.navLink}>
            Panel
          </Link>
        </nav>
      </div>
    </header>
  );
}
