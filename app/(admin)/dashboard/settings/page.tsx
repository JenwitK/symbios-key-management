import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { KNOWN_PROVIDER_IDS } from "@/lib/providers";
import { SettingsForm } from "./SettingsForm";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select("key_prefix, default_reset_limit, providers")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    key_prefix: (data?.key_prefix as string | undefined) ?? "SYMBIOS",
    default_reset_limit: (data?.default_reset_limit as number | undefined) ?? 3,
    providers:
      (data?.providers as Record<string, { enabled?: boolean }> | undefined) ?? {},
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSubtitle}>
        Key format, default HWID resets, and which redeem providers are live.
      </p>

      <SettingsForm
        initialKeyPrefix={settings.key_prefix}
        initialDefaultResetLimit={settings.default_reset_limit}
        initialProviders={settings.providers}
        providerIds={KNOWN_PROVIDER_IDS}
      />
    </div>
  );
}
