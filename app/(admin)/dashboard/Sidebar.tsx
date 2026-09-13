import Link from "next/link";
import styles from "./dashboard.module.css";

const NAV_ITEMS = [
  { href: "/dashboard/keys", label: "Keys" },
  { href: "/dashboard/bulk", label: "Bulk keys" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/scripts", label: "Scripts" },
  { href: "/dashboard/announcement", label: "Announcement" },
  { href: "/dashboard/logs", label: "Logs" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Dashboard">
        <ul className={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
