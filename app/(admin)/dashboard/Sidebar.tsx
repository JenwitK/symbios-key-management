"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search, LogOut } from "lucide-react";
import { NAV_ITEMS, NAV_GROUPS, isNavItemActive, type NavGroupKey } from "./nav";
import { useCommandPalette } from "@/components/CommandPalette/CommandPaletteContext";
import { useMaintenanceToggle } from "@/lib/useMaintenanceToggle";
import { useNavDrawer } from "./NavDrawerContext";
import { logout } from "./actions";
import styles from "./dashboard.module.css";

export type SidebarProps = {
  username: string;
  envLabel: string;
  region: string;
  apiMs: number | null;
  statusTone: "ok" | "warn" | "err";
  statusLabel: string;
  counts: {
    keys: number | null;
    customers: number | null;
    scripts: number | null;
  };
  initialMaintenance: boolean;
};

function activeGroup(pathname: string): NavGroupKey | null {
  const item = NAV_ITEMS.find((entry) => isNavItemActive(pathname, entry.href));
  return item && item.group !== "top" ? item.group : null;
}

function formatCount(value: number | null): string | null {
  if (value === null) return "-";
  return value.toLocaleString("en-US");
}

export function Sidebar({
  username,
  envLabel,
  region,
  apiMs,
  statusTone,
  statusLabel,
  counts,
  initialMaintenance,
}: SidebarProps) {
  const pathname = usePathname();
  const { openPalette } = useCommandPalette();
  const { open: drawerOpen } = useNavDrawer();
  const { maintenance, toggle, isPending } = useMaintenanceToggle(initialMaintenance);

  const [openGroups, setOpenGroups] = useState<Set<NavGroupKey>>(() => {
    const initial = new Set<NavGroupKey>();
    const active = activeGroup(pathname);
    if (active) initial.add(active);
    return initial;
  });

  // Auto-open the group of the current page, adjusted during render (not an
  // effect) per React's "adjusting state when a prop changes" pattern.
  const [syncedForPathname, setSyncedForPathname] = useState(pathname);
  if (pathname !== syncedForPathname) {
    setSyncedForPathname(pathname);
    const active = activeGroup(pathname);
    if (active && !openGroups.has(active)) {
      const next = new Set(openGroups);
      next.add(active);
      setOpenGroups(next);
    }
  }

  function toggleGroup(key: NavGroupKey) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const topItems = NAV_ITEMS.filter((item) => item.group === "top");
  const countByHref: Record<string, string | null> = {
    "/dashboard/keys": formatCount(counts.keys),
    "/dashboard/customers": formatCount(counts.customers),
    "/dashboard/scripts": formatCount(counts.scripts),
  };

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <aside className={drawerOpen ? `${styles.sidebar} ${styles.sidebarOpen}` : styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="9" cy="12" r="5.5" />
              <circle cx="15" cy="12" r="5.5" />
            </g>
          </svg>
        </div>
        <span className={styles.brandName}>SYMBIOS</span>
        <span className={styles.envPill}>{envLabel}</span>
      </div>

      <button type="button" className={styles.cmdTrigger} onClick={openPalette}>
        <Search size={14} strokeWidth={1.8} />
        <span>Search or jump to</span>
        <span className={styles.kbd}>Ctrl K</span>
      </button>

      <nav className={styles.nav} aria-label="Dashboard">
        <div className={styles.navTop}>
          {topItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              >
                <Icon size={16} strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.key);
          const isOpen = openGroups.has(group.key);
          return (
            <div key={group.key} className={styles.navGroup}>
              <button
                type="button"
                className={styles.navGroupHead}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.key)}
              >
                {group.label}
                <ChevronDown
                  size={12}
                  className={isOpen ? `${styles.navChevron} ${styles.navChevronOpen}` : styles.navChevron}
                />
              </button>

              <div
                className={
                  isOpen ? `${styles.navCollapse} ${styles.navCollapseOpen}` : styles.navCollapse
                }
              >
                <div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(pathname, item.href);
                    const count = countByHref[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={
                          active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                        }
                      >
                        <Icon size={16} strokeWidth={1.6} />
                        {item.label}
                        {count !== undefined && count !== null ? (
                          <span className={styles.navCount}>{count}</span>
                        ) : null}
                        {item.live ? <span className={styles.liveDot} title="Live" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className={styles.sideFoot}>
        <div className={styles.sysCard}>
          <div className={styles.sysRow}>
            <span className={`${styles.dot} ${styles[statusTone]}`} />
            {statusLabel}
          </div>
          <div className={styles.sysRow}>
            <span className={styles.dot} />
            API
            <span className={styles.sysRowValue}>
              {region} &middot; {apiMs !== null ? `${apiMs}ms` : "-"}
            </span>
          </div>
          <div className={styles.sysRow}>
            <span className={styles.dot} />
            Maintenance
            <button
              type="button"
              className={maintenance ? `${styles.switch} ${styles.switchOn}` : styles.switch}
              aria-label="Toggle maintenance"
              aria-pressed={maintenance}
              disabled={isPending}
              onClick={() => void toggle()}
            >
              <span className={styles.switchThumb} />
            </button>
          </div>
        </div>

        <div className={styles.userRow}>
          <div className={styles.avatar}>{initials || "AD"}</div>
          <div className={styles.userMeta}>
            <b>{username}</b>
            <span>Admin</span>
          </div>
          <form action={logout}>
            <button type="submit" className={styles.iconBtn} aria-label="Log out" title="Log out">
              <LogOut size={15} strokeWidth={1.7} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
