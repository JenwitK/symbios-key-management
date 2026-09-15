"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import styles from "./settings.module.css";

export type MismatchSpikeRule = {
  enabled: boolean;
  threshold: number;
  window_min: number;
  cooldown_min: number;
};
export type ServerErrorSpikeRule = MismatchSpikeRule;
export type KeySharingRule = {
  enabled: boolean;
  distinct_hwid: number;
  distinct_ip: number;
  window_min: number;
  cooldown_min: number;
};
export type BannedUseRule = { enabled: boolean; cooldown_min: number };
export type FirstActivationRule = { enabled: boolean };

export type AlertRules = {
  mismatch_spike: MismatchSpikeRule;
  server_error_spike: ServerErrorSpikeRule;
  key_sharing: KeySharingRule;
  banned_use: BannedUseRule;
  first_activation: FirstActivationRule;
};

type SettingsFormProps = {
  initialKeyPrefix: string;
  initialDefaultResetLimit: number;
  initialDiscordUrl: string;
  initialAnnounceAutoSecs: number;
  initialMaintenance: boolean;
  initialAlertWebhookUrl: string;
  initialAlertsEnabled: boolean;
  initialAlertRules: AlertRules;
};

function parsedOrKeep(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsForm({
  initialKeyPrefix,
  initialDefaultResetLimit,
  initialDiscordUrl,
  initialAnnounceAutoSecs,
  initialMaintenance,
  initialAlertWebhookUrl,
  initialAlertsEnabled,
  initialAlertRules,
}: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maintenance, setMaintenance] = useState(initialMaintenance);

  const [alertWebhookUrl, setAlertWebhookUrl] = useState(initialAlertWebhookUrl);
  const [alertsEnabled, setAlertsEnabled] = useState(initialAlertsEnabled);
  const [alertRules, setAlertRules] = useState<AlertRules>(initialAlertRules);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  function updateMismatchSpike(patch: Partial<MismatchSpikeRule>) {
    setAlertRules((current) => ({
      ...current,
      mismatch_spike: { ...current.mismatch_spike, ...patch },
    }));
  }

  function updateServerErrorSpike(patch: Partial<ServerErrorSpikeRule>) {
    setAlertRules((current) => ({
      ...current,
      server_error_spike: { ...current.server_error_spike, ...patch },
    }));
  }

  function updateKeySharing(patch: Partial<KeySharingRule>) {
    setAlertRules((current) => ({
      ...current,
      key_sharing: { ...current.key_sharing, ...patch },
    }));
  }

  function updateBannedUse(patch: Partial<BannedUseRule>) {
    setAlertRules((current) => ({
      ...current,
      banned_use: { ...current.banned_use, ...patch },
    }));
  }

  function updateFirstActivation(patch: Partial<FirstActivationRule>) {
    setAlertRules((current) => ({
      ...current,
      first_activation: { ...current.first_activation, ...patch },
    }));
  }

  function numberInputHandler(
    fallback: number,
    apply: (value: number) => void,
  ) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      apply(parsedOrKeep(event.target.value, fallback));
    };
  }

  async function handleSendTest() {
    setTestResult(null);
    setIsTesting(true);
    try {
      const trimmed = alertWebhookUrl.trim();
      const res = await fetch("/api/admin/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed ? { webhook_url: trimmed } : {}),
      });
      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setTestResult({ ok: false, message: json.error ?? "Could not send test alert." });
        return;
      }

      setTestResult({ ok: true });
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const keyPrefix = (formData.get("key_prefix") as string).trim();
    const defaultResetLimit = Number(formData.get("default_reset_limit"));
    const discordUrl = (formData.get("discord_url") as string).trim();
    const announceAutoSecs = Number(formData.get("announce_auto_secs"));
    const trimmedWebhookUrl = alertWebhookUrl.trim();

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_prefix: keyPrefix,
          default_reset_limit: Number.isFinite(defaultResetLimit)
            ? defaultResetLimit
            : undefined,
          discord_url: discordUrl,
          announce_auto_secs: Number.isFinite(announceAutoSecs)
            ? announceAutoSecs
            : undefined,
          maintenance,
          alert_webhook_url: trimmedWebhookUrl ? trimmedWebhookUrl : null,
          alerts_enabled: alertsEnabled,
          alert_rules: alertRules,
        }),
      });

      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Could not save settings.");
        return;
      }

      setSaved(true);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formRow}>
        <label className={styles.field}>
          <span className={styles.label}>Key prefix</span>
          <input
            name="key_prefix"
            type="text"
            defaultValue={initialKeyPrefix}
            required
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Default HWID reset limit</span>
          <input
            name="default_reset_limit"
            type="number"
            min={0}
            defaultValue={initialDefaultResetLimit}
            required
            className={styles.input}
          />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.field}>
          <span className={styles.label}>Discord URL</span>
          <input
            name="discord_url"
            type="text"
            defaultValue={initialDiscordUrl}
            required
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Auto-close seconds</span>
          <input
            name="announce_auto_secs"
            type="number"
            min={0}
            defaultValue={initialAnnounceAutoSecs}
            required
            className={styles.input}
          />
        </label>
      </div>

      <div className={styles.toggleRow}>
        <div className={styles.toggleText}>
          <span className={styles.label}>Maintenance mode</span>
          <p className={styles.toggleHelp}>
            When on, all games show the maintenance screen and no scripts are served.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={maintenance}
          className={
            maintenance ? `${styles.switch} ${styles.switchOn}` : styles.switch
          }
          onClick={() => setMaintenance((current) => !current)}
        >
          <span className={styles.switchThumb} />
        </button>
      </div>

      <div className={styles.sectionDivider}>
        <h2 className={styles.sectionTitle}>Discord alerts</h2>
        <p className={styles.toggleHelp}>
          Webhook and rule thresholds can be changed at any time, this does not affect
          the loader.
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Webhook URL</span>
        <input
          type="url"
          value={alertWebhookUrl}
          onChange={(event) => setAlertWebhookUrl(event.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className={styles.input}
        />
      </label>

      <div className={styles.testRow}>
        <Button type="button" variant="ghost" disabled={isTesting} onClick={handleSendTest}>
          {isTesting ? "Sending..." : "Send test"}
        </Button>
        {testResult?.ok ? (
          <span className={styles.saved}>Sent, check Discord.</span>
        ) : null}
        {testResult && !testResult.ok ? (
          <span className={styles.error}>{testResult.message}</span>
        ) : null}
      </div>

      <div className={styles.toggleRow}>
        <div className={styles.toggleText}>
          <span className={styles.label}>Enable alerts</span>
          <p className={styles.toggleHelp}>
            Master switch. When off, the scanner sends nothing regardless of the rules
            below.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alertsEnabled}
          className={
            alertsEnabled ? `${styles.switch} ${styles.switchOn}` : styles.switch
          }
          onClick={() => setAlertsEnabled((current) => !current)}
        >
          <span className={styles.switchThumb} />
        </button>
      </div>

      <div className={styles.ruleList}>
        <div className={styles.ruleRow}>
          <label className={styles.ruleToggle}>
            <input
              type="checkbox"
              checked={alertRules.mismatch_spike.enabled}
              onChange={(event) => updateMismatchSpike({ enabled: event.target.checked })}
              className={styles.checkbox}
            />
            <span className={styles.ruleName}>HWID mismatch spike</span>
          </label>
          <div className={styles.ruleFields}>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Threshold</span>
              <input
                type="number"
                min={1}
                value={alertRules.mismatch_spike.threshold}
                onChange={numberInputHandler(
                  alertRules.mismatch_spike.threshold,
                  (value) => updateMismatchSpike({ threshold: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Window (min)</span>
              <input
                type="number"
                min={1}
                value={alertRules.mismatch_spike.window_min}
                onChange={numberInputHandler(
                  alertRules.mismatch_spike.window_min,
                  (value) => updateMismatchSpike({ window_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Cooldown (min)</span>
              <input
                type="number"
                min={0}
                value={alertRules.mismatch_spike.cooldown_min}
                onChange={numberInputHandler(
                  alertRules.mismatch_spike.cooldown_min,
                  (value) => updateMismatchSpike({ cooldown_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
          </div>
        </div>

        <div className={styles.ruleRow}>
          <label className={styles.ruleToggle}>
            <input
              type="checkbox"
              checked={alertRules.server_error_spike.enabled}
              onChange={(event) =>
                updateServerErrorSpike({ enabled: event.target.checked })
              }
              className={styles.checkbox}
            />
            <span className={styles.ruleName}>Server error spike</span>
          </label>
          <div className={styles.ruleFields}>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Threshold</span>
              <input
                type="number"
                min={1}
                value={alertRules.server_error_spike.threshold}
                onChange={numberInputHandler(
                  alertRules.server_error_spike.threshold,
                  (value) => updateServerErrorSpike({ threshold: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Window (min)</span>
              <input
                type="number"
                min={1}
                value={alertRules.server_error_spike.window_min}
                onChange={numberInputHandler(
                  alertRules.server_error_spike.window_min,
                  (value) => updateServerErrorSpike({ window_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Cooldown (min)</span>
              <input
                type="number"
                min={0}
                value={alertRules.server_error_spike.cooldown_min}
                onChange={numberInputHandler(
                  alertRules.server_error_spike.cooldown_min,
                  (value) => updateServerErrorSpike({ cooldown_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
          </div>
        </div>

        <div className={styles.ruleRow}>
          <label className={styles.ruleToggle}>
            <input
              type="checkbox"
              checked={alertRules.key_sharing.enabled}
              onChange={(event) => updateKeySharing({ enabled: event.target.checked })}
              className={styles.checkbox}
            />
            <span className={styles.ruleName}>Key sharing</span>
          </label>
          <div className={styles.ruleFields}>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Distinct HWID</span>
              <input
                type="number"
                min={1}
                value={alertRules.key_sharing.distinct_hwid}
                onChange={numberInputHandler(
                  alertRules.key_sharing.distinct_hwid,
                  (value) => updateKeySharing({ distinct_hwid: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Distinct IP</span>
              <input
                type="number"
                min={1}
                value={alertRules.key_sharing.distinct_ip}
                onChange={numberInputHandler(
                  alertRules.key_sharing.distinct_ip,
                  (value) => updateKeySharing({ distinct_ip: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Window (min)</span>
              <input
                type="number"
                min={1}
                value={alertRules.key_sharing.window_min}
                onChange={numberInputHandler(
                  alertRules.key_sharing.window_min,
                  (value) => updateKeySharing({ window_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Cooldown (min)</span>
              <input
                type="number"
                min={0}
                value={alertRules.key_sharing.cooldown_min}
                onChange={numberInputHandler(
                  alertRules.key_sharing.cooldown_min,
                  (value) => updateKeySharing({ cooldown_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
          </div>
        </div>

        <div className={styles.ruleRow}>
          <label className={styles.ruleToggle}>
            <input
              type="checkbox"
              checked={alertRules.banned_use.enabled}
              onChange={(event) => updateBannedUse({ enabled: event.target.checked })}
              className={styles.checkbox}
            />
            <span className={styles.ruleName}>Banned/paused use</span>
          </label>
          <div className={styles.ruleFields}>
            <label className={styles.ruleField}>
              <span className={styles.ruleFieldLabel}>Cooldown (min)</span>
              <input
                type="number"
                min={0}
                value={alertRules.banned_use.cooldown_min}
                onChange={numberInputHandler(
                  alertRules.banned_use.cooldown_min,
                  (value) => updateBannedUse({ cooldown_min: value }),
                )}
                className={styles.ruleNumberInput}
              />
            </label>
          </div>
        </div>

        <div className={styles.ruleRow}>
          <label className={styles.ruleToggle}>
            <input
              type="checkbox"
              checked={alertRules.first_activation.enabled}
              onChange={(event) =>
                updateFirstActivation({ enabled: event.target.checked })
              }
              className={styles.checkbox}
            />
            <span className={styles.ruleName}>First activation</span>
          </label>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {saved ? <p className={styles.saved}>Saved.</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
