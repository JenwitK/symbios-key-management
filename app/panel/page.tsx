import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { getUserSession } from "@/lib/require-user";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SignInPanel } from "./SignInPanel";
import {
  PanelView,
  type PanelKeyRow,
  type ScriptAccess,
  type AnnouncementRow,
} from "./PanelView";
import styles from "./panel.module.css";

export const metadata: Metadata = {
  title: "Panel · SYMBIOS",
};

type KeyScriptRow = {
  key_id: string;
  scripts: { name: string; slug: string } | null;
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
  const keyIds = keys.map((key) => key.id);

  const [keyScriptsResult, announcementsResult] = await Promise.all([
    keyIds.length
      ? adminClient
          .from("key_scripts")
          .select("key_id, scripts(name, slug)")
          .in("key_id", keyIds)
      : Promise.resolve({ data: [] as KeyScriptRow[] }),
    adminClient
      .from("announcements")
      .select("tag, title, body")
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .limit(3),
  ]);

  const scriptsByKey: Record<string, ScriptAccess[]> = {};
  for (const row of (keyScriptsResult.data ?? []) as KeyScriptRow[]) {
    const script = row.scripts;
    if (!script) continue;
    const list = scriptsByKey[row.key_id] ?? [];
    list.push({ name: script.name, slug: script.slug });
    scriptsByKey[row.key_id] = list;
  }

  const announcements = (announcementsResult.data ?? []) as AnnouncementRow[];

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <PanelView
          keys={keys}
          scriptsByKey={scriptsByKey}
          announcements={announcements}
          username={session.username}
          avatarUrl={session.avatarUrl}
        />
      </main>
      <Footer />
    </>
  );
}
