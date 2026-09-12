import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { getUserSession } from "@/lib/require-user";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SignInPanel } from "./SignInPanel";
import { PanelView, type PanelKeyRow } from "./PanelView";
import styles from "./panel.module.css";

export const metadata: Metadata = {
  title: "Panel — SYMBIOS",
};

export default async function PanelPage() {
  const session = await getUserSession();

  if (!session) {
    return (
      <>
        <Navbar />
        <main className={styles.page}>
          <SignInPanel />
        </main>
        <Footer />
      </>
    );
  }

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("keys")
    .select(
      "id, key_value, status, hwid, hwid_resets, hwid_reset_limit, expires_at",
    )
    .eq("discord_id", session.discordId)
    .order("created_at", { ascending: false });

  const keys = (data ?? []) as PanelKeyRow[];

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <PanelView keys={keys} />
      </main>
      <Footer />
    </>
  );
}
