"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import styles from "./settings.module.css";

type SettingsFormProps = {
  initialKeyPrefix: string;
  initialDefaultResetLimit: number;
};

export function SettingsForm({
  initialKeyPrefix,
  initialDefaultResetLimit,
}: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const keyPrefix = (formData.get("key_prefix") as string).trim();
    const defaultResetLimit = Number(formData.get("default_reset_limit"));

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_prefix: keyPrefix,
          default_reset_limit: Number.isFinite(defaultResetLimit)
            ? defaultResetLimit
            : undefined,
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

      {error ? <p className={styles.error}>{error}</p> : null}
      {saved ? <p className={styles.saved}>Saved.</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
