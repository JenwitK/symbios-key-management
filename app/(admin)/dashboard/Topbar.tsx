import Link from "next/link";
import { logout } from "./actions";
import styles from "./dashboard.module.css";

export function Topbar() {
  return (
    <header className={styles.topbar}>
      <Link href="/dashboard" className={styles.wordmark}>
        SYM<span className={styles.wordmarkDim}>BIOS</span>
      </Link>

      <form action={logout}>
        <button type="submit" className={styles.logoutButton}>
          Log out
        </button>
      </form>
    </header>
  );
}
