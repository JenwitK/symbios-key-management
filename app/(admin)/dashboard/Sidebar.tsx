"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import styles from "./dashboard.module.css";

const NAV_SECTIONS = [
  {
    label: "Manage",
    items: [
      { href: "/dashboard/keys", label: "Keys" },
      { href: "/dashboard/bulk", label: "Bulk keys" },
      { href: "/dashboard/customers", label: "Customers" },
      { href: "/dashboard/scripts", label: "Scripts" },
      { href: "/dashboard/obfuscator", label: "Obfuscator" },
      { href: "/dashboard/announcement", label: "Announcement" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/logs", label: "Logs" },
      { href: "/dashboard/analytics", label: "Analytics" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/dashboard/settings", label: "Settings" }],
  },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeSectionLabel(pathname: string): string | null {
  const section = NAV_SECTIONS.find((s) =>
    s.items.some((item) => isActive(pathname, item.href)),
  );
  return section?.label ?? null;
}

export function Sidebar() {
  const pathname = usePathname();

  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const active = activeSectionLabel(pathname);
    if (active) initial.add(active);
    return initial;
  });

  useEffect(() => {
    const active = activeSectionLabel(pathname);
    if (!active) return;

    setOpen((current) => {
      if (current.has(active)) return current;
      const next = new Set(current);
      next.add(active);
      return next;
    });
  }, [pathname]);

  function toggleSection(label: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Dashboard">
        {NAV_SECTIONS.map((section) => {
          const isOpen = open.has(section.label);
          return (
            <div key={section.label} className={styles.navSection}>
              <button
                type="button"
                className={styles.navSectionHeader}
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.label)}
              >
                {section.label}
                <ChevronDown
                  size={12}
                  className={
                    isOpen
                      ? `${styles.navChevron} ${styles.navChevronOpen}`
                      : styles.navChevron
                  }
                />
              </button>

              <div
                className={
                  isOpen
                    ? `${styles.navCollapse} ${styles.navCollapseOpen}`
                    : styles.navCollapse
                }
              >
                <ul className={styles.navList}>
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={
                            active
                              ? `${styles.navLink} ${styles.navLinkActive}`
                              : styles.navLink
                          }
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
