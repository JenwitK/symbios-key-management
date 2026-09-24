"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ChevronRight, RefreshCw } from "lucide-react";
import { findActiveNavItem } from "./nav";
import { useNavDrawer } from "./NavDrawerContext";
import { useSyncActions, useSyncStatus, formatSyncAgo } from "@/components/Sync/SyncProvider";
import { useBreadcrumbOverride } from "./BreadcrumbContext";
import styles from "./dashboard.module.css";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggle } = useNavDrawer();
  const { markSynced } = useSyncActions();
  const { live, lastSync } = useSyncStatus();
  const [isPending, startTransition] = useTransition();
  const override = useBreadcrumbOverride();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mark synced once the refresh transition actually finishes, not on click.
  useEffect(() => {
    if (!isPending) {
      markSynced();
    }
  }, [isPending, markSynced]);

  // A navigation re-renders server data too, so it counts as a fresh sync.
  useEffect(() => {
    markSynced();
  }, [pathname, markSynced]);

  const navItem = findActiveNavItem(pathname);
  const leading = override?.leading ?? "Dashboard";
  const trailing = override?.trailing ?? navItem?.label ?? "Dashboard";

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.menuBtn}`}
        aria-label="Open menu"
        onClick={toggle}
      >
        <Menu size={18} strokeWidth={1.8} />
      </button>

      <div className={styles.crumbs}>
        <span className={styles.hideSm}>{leading}</span>
        <ChevronRight size={14} className={styles.hideSm} />
        <b>{trailing}</b>
      </div>

      <div className={styles.topRight}>
        <div className={styles.livePill}>
          {live ? (
            <>
              <span className={styles.liveDot} />
              LIVE
              <span className={styles.sep} />
            </>
          ) : null}
          <span className={styles.ago}>{formatSyncAgo(now - lastSync)}</span>
        </div>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw size={15} strokeWidth={1.8} className={isPending ? styles.spinning : undefined} />
        </button>
      </div>
    </header>
  );
}
