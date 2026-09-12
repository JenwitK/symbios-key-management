import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./SettingsForm";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select("key_prefix, default_reset_limit")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    key_prefix: (data?.key_prefix as string | undefined) ?? "SYMBIOS",
    default_reset_limit: (data?.default_reset_limit as number | undefined) ?? 3,
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSubtitle}>
        Key format and default HWID resets.
      </p>

      <SettingsForm
        initialKeyPrefix={settings.key_prefix}
        initialDefaultResetLimit={settings.default_reset_limit}
      />
    </div>
  );
}
