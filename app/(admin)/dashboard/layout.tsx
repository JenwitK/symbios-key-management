import { requireAdminPage } from "@/lib/require-admin";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireAdminPage();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
