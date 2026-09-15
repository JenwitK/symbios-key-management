import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm, type AlertRules } from "./SettingsForm";
import styles from "./settings.module.css";

type PartialAlertRules = {
  mismatch_spike?: Partial<AlertRules["mismatch_spike"]>;
  server_error_spike?: Partial<AlertRules["server_error_spike"]>;
  key_sharing?: Partial<AlertRules["key_sharing"]>;
  banned_use?: Partial<AlertRules["banned_use"]>;
  first_activation?: Partial<AlertRules["first_activation"]>;
};

const DEFAULT_ALERT_RULES: AlertRules = {
  mismatch_spike: { enabled: true, threshold: 10, window_min: 15, cooldown_min: 30 },
  server_error_spike: { enabled: true, threshold: 20, window_min: 15, cooldown_min: 30 },
  key_sharing: {
    enabled: true,
    distinct_hwid: 2,
    distinct_ip: 3,
    window_min: 60,
    cooldown_min: 120,
  },
  banned_use: { enabled: true, cooldown_min: 60 },
  first_activation: { enabled: true },
};

function mergeAlertRules(rules: PartialAlertRules | null | undefined): AlertRules {
  return {
    mismatch_spike: { ...DEFAULT_ALERT_RULES.mismatch_spike, ...rules?.mismatch_spike },
    server_error_spike: {
      ...DEFAULT_ALERT_RULES.server_error_spike,
      ...rules?.server_error_spike,
    },
    key_sharing: { ...DEFAULT_ALERT_RULES.key_sharing, ...rules?.key_sharing },
    banned_use: { ...DEFAULT_ALERT_RULES.banned_use, ...rules?.banned_use },
    first_activation: {
      ...DEFAULT_ALERT_RULES.first_activation,
      ...rules?.first_activation,
    },
  };
}

export default async function SettingsPage() {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select(
      "key_prefix, default_reset_limit, discord_url, announce_auto_secs, maintenance, alert_webhook_url, alerts_enabled, alert_rules",
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
    maintenance: (data?.maintenance as boolean | undefined) ?? false,
    alert_webhook_url: (data?.alert_webhook_url as string | null | undefined) ?? "",
    alerts_enabled: (data?.alerts_enabled as boolean | undefined) ?? false,
    alert_rules: mergeAlertRules(data?.alert_rules as PartialAlertRules | null | undefined),
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSubtitle}>
        Key format, default HWID resets, announcement config, and Discord alerts.
      </p>

      <SettingsForm
        initialKeyPrefix={settings.key_prefix}
        initialDefaultResetLimit={settings.default_reset_limit}
        initialDiscordUrl={settings.discord_url}
        initialAnnounceAutoSecs={settings.announce_auto_secs}
        initialMaintenance={settings.maintenance}
        initialAlertWebhookUrl={settings.alert_webhook_url}
        initialAlertsEnabled={settings.alerts_enabled}
        initialAlertRules={settings.alert_rules}
      />
    </div>
  );
}
