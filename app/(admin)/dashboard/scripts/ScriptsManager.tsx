"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import { confirmDialog } from "@/lib/confirm";
import styles from "./scripts.module.css";

export type ScriptRow = {
  id: string;
  name: string;
  slug: string;
  content: string | null;
  version: number;
  status: "active" | "disabled";
  keyless: boolean;
  updated_at: string;
};

type ScriptsManagerProps = {
  scripts: ScriptRow[];
};

function formatBytes(input: string | null) {
  if (!input) return "0 B";
  const bytes = new TextEncoder().encode(input).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ScriptsManager({ scripts }: ScriptsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<ScriptRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formOpen = isCreating || editing !== null;

  function closeForm() {
    setIsCreating(false);
    setEditing(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      content: formData.get("content"),
      status: formData.get("status"),
      keyless: formData.get("keyless") === "on",
    };

    try {
      const res = await fetch("/api/admin/scripts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { id: editing.id, ...payload } : payload,
        ),
      });

      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }

      closeForm();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(script: ScriptRow) {
    const ok = await confirmDialog({
      title: "Delete this script?",
      text: `"${script.name}" cannot be recovered after this.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch("/api/admin/scripts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: script.id }),
    });

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Scripts</h1>
          <p className={styles.pageSubtitle}>
            Served as-is by /api/v1/validate.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setEditing(null);
            setError(null);
          }}
        >
          New script
        </Button>
      </div>

      {formOpen ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                name="name"
                type="text"
                defaultValue={editing?.name}
                required
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Slug</span>
              <input
                name="slug"
                type="text"
                defaultValue={editing?.slug}
                pattern="[a-z0-9-]+"
                title="lowercase letters, numbers, and hyphens only"
                required
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Status</span>
              <select
                name="status"
                defaultValue={editing?.status ?? "active"}
                className={styles.input}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
          </div>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              name="keyless"
              defaultChecked={editing?.keyless ?? false}
            />
            Keyless (no key required)
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Content (obfuscated, paste MoonVeil output)
            </span>
            <textarea
              name="content"
              defaultValue={editing?.content ?? ""}
              rows={10}
              spellCheck={false}
              className={styles.textarea}
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.formActions}>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create script"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className={styles.tableWrap}>
        <div className={styles.table}>
          <div className={styles.row}>
            <div className={styles.headerCell}>Name</div>
            <div className={styles.headerCell}>Slug</div>
            <div className={styles.headerCell}>Status</div>
            <div className={styles.headerCell}>Size</div>
            <div className={styles.headerCell}>Version</div>
            <div className={styles.headerCell}>Updated</div>
            <div className={styles.headerCell} aria-label="Actions" />
          </div>

          {scripts.map((script) => (
            <div key={script.id} className={styles.row}>
              <div className={styles.cell}>{script.name}</div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {script.slug}
              </div>
              <div className={styles.cell}>
                <Badge tone={script.status === "active" ? "ok" : "neutral"}>
                  {script.status}
                </Badge>
                {script.keyless ? (
                  <Badge tone="neutral">keyless</Badge>
                ) : null}
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {formatBytes(script.content)}
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                v{script.version}
              </div>
              <div className={`${styles.cell} ${styles.mono} ${styles.time}`}>
                {formatDate(script.updated_at)}
              </div>
              <div className={styles.actionsCell}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setEditing(script);
                    setIsCreating(false);
                    setError(null);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => handleDelete(script)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {scripts.length === 0 ? (
            <div className={styles.empty}>No scripts yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
