import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Admin login — SYMBIOS",
};

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <Link href="/" className={styles.wordmark}>
          SYM<span className={styles.wordmarkDim}>BIOS</span>
        </Link>
        <p className={styles.eyebrow}>Admin console</p>
        <LoginForm />
      </div>
    </div>
  );
}
