import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./SettingsForm";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select(
      "key_prefix, default_reset_limit, discord_url, announce_auto_secs",
    )
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    key_prefix: (data?.key_prefix as string | undefined) ?? "SYMBIOS",
    default_reset_limit: (data?.default_reset_limit as number | undefined) ?? 3,
    discord_url:
      (data?.discord_url as string | undefined) ??
      "https://discord.gg/RWbYvbyB2",
    announce_auto_secs: (data?.announce_auto_secs as number | undefined) ?? 15,
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSubtitle}>
        Key format, default HWID resets, and announcement config.
      </p>

      <SettingsForm
        initialKeyPrefix={settings.key_prefix}
        initialDefaultResetLimit={settings.default_reset_limit}
        initialDiscordUrl={settings.discord_url}
        initialAnnounceAutoSecs={settings.announce_auto_secs}
      />
    </div>
  );
}
