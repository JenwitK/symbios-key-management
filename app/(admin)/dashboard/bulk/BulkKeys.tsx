"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import { fromBangkokInputValue } from "@/lib/datetime";
import styles from "./bulk.module.css";

export type ScriptOption = {
  id: string;
  name: string;
};

type BulkKeysProps = {
  scripts: ScriptOption[];
};

export function BulkKeys({ scripts }: BulkKeysProps) {
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keys, setKeys] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScript(scriptId: string) {
    setSelectedScriptIds((current) =>
      current.includes(scriptId)
        ? current.filter((id) => id !== scriptId)
        : [...current, scriptId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setKeys(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const count = Number(formData.get("count"));
    const label = (formData.get("label") as string).trim();
    const expiresRaw = formData.get("expires_at") as string;
    const hwidResetLimitRaw = (formData.get("hwid_reset_limit") as string).trim();

    const payload = {
      count,
      label: label || undefined,
      expires_at: fromBangkokInputValue(expiresRaw),
      hwid_reset_limit: hwidResetLimitRaw ? Number(hwidResetLimitRaw) : undefined,
      script_ids: selectedScriptIds,
    };

    try {
      const res = await fetch("/api/admin/keys/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: { error?: string; keys?: { key_value: string }[] } =
        await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }

      setKeys((json.keys ?? []).map((key) => key.key_value));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!keys) return;
    await navigator.clipboard.writeText(keys.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    if (!keys) return;
    const blob = new Blob([keys.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "symbios-keys.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Bulk keys</h1>
      <p className={styles.pageSubtitle}>
        Generate many keys at once to sell in Discord.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span className={styles.label}>Count</span>
            <input
              name="count"
              type="number"
              min={1}
              max={100}
              defaultValue={10}
              required
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Label</span>
            <input
              name="label"
              type="text"
              placeholder="e.g. discord batch"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Expires (blank = lifetime)</span>
            <input name="expires_at" type="datetime-local" className={styles.input} />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>HWID reset limit</span>
            <input
              name="hwid_reset_limit"
              type="number"
              min={0}
              placeholder="default"
              className={styles.input}
            />
          </label>
        </div>

        <fieldset className={styles.scriptsField}>
          <legend className={styles.label}>Script access</legend>
          {scripts.length === 0 ? (
            <p className={styles.pageSubtitle}>No scripts yet.</p>
          ) : (
            <div className={styles.scriptsGrid}>
              {scripts.map((script) => (
                <label key={script.id} className={styles.scriptOption}>
                  <input
                    type="checkbox"
                    checked={selectedScriptIds.includes(script.id)}
                    onChange={() => toggleScript(script.id)}
                  />
                  {script.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.formActions}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate"}
          </Button>
        </div>
      </form>

      {keys ? (
        <div className={styles.resultPanel}>
          <p className={styles.label}>{keys.length} keys generated</p>
          <textarea
            readOnly
            value={keys.join("\n")}
            rows={Math.min(keys.length, 12)}
            spellCheck={false}
            className={styles.resultTextarea}
          />
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={handleCopy}>
              {copied ? "Copied" : "Copy all"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleDownload}>
              Download .txt
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
