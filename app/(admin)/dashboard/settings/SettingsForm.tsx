"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import styles from "./settings.module.css";

type SettingsFormProps = {
  initialKeyPrefix: string;
  initialDefaultResetLimit: number;
  initialDiscordUrl: string;
  initialAnnounceAutoSecs: number;
  initialMaintenance: boolean;
};

export function SettingsForm({
  initialKeyPrefix,
  initialDefaultResetLimit,
  initialDiscordUrl,
  initialAnnounceAutoSecs,
  initialMaintenance,
}: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maintenance, setMaintenance] = useState(initialMaintenance);

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

      {error ? <p className={styles.error}>{error}</p> : null}
      {saved ? <p className={styles.saved}>Saved.</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
