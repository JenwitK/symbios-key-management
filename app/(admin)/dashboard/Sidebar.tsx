"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

const NAV_SECTIONS = [
  {
    label: "Manage",
    items: [
      { href: "/dashboard/keys", label: "Keys" },
      { href: "/dashboard/bulk", label: "Bulk keys" },
      { href: "/dashboard/customers", label: "Customers" },
      { href: "/dashboard/scripts", label: "Scripts" },
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

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Dashboard">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className={styles.navSection}>
            <p className={styles.navSectionLabel}>{section.label}</p>
            <ul className={styles.navList}>
              {section.items.map((item) => {
                const active = isActive(item.href);
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
        ))}
      </nav>
    </aside>
  );
}
