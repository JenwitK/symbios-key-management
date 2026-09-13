"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import styles from "./RefreshButton.module.css";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      disabled={isPending}
      aria-label="Refresh data"
    >
      <RefreshCw
        size={14}
        className={isPending ? styles.spinning : undefined}
      />
      Refresh
    </button>
  );
}
