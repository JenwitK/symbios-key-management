"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import styles from "./keys.module.css";

export type KeyStatus = "active" | "paused" | "banned" | "expired";

export type KeyRow = {
  id: string;
  key_value: string;
  label: string | null;
  status: KeyStatus;
  hwid: string | null;
  hwid_resets: number;
  hwid_reset_limit: number;
  expires_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type ScriptOption = {
  id: string;
  name: string;
};

type KeysManagerProps = {
  keys: KeyRow[];
  scripts: ScriptOption[];
  keyScriptMap: Record<string, string[]>;
  defaultResetLimit: number;
};

const STATUS_FILTERS = ["all", "active", "paused", "banned", "expired"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_TONE: Record<KeyStatus, "ok" | "warn" | "err" | "neutral"> = {
  active: "ok",
  paused: "warn",
  banned: "err",
  expired: "neutral",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function KeysManager({
  keys,
  scripts,
  keyScriptMap,
  defaultResetLimit,
}: KeysManagerProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const formOpen = isCreating || editing !== null;

  const visibleKeys = useMemo(() => {
    if (statusFilter === "all") return keys;
    return keys.filter((key) => key.status === statusFilter);
  }, [keys, statusFilter]);

  function openCreateForm() {
    setEditing(null);
    setIsCreating(true);
    setSelectedScriptIds([]);
    setError(null);
  }

  function openEditForm(key: KeyRow) {
    setIsCreating(false);
    setEditing(key);
    setSelectedScriptIds(keyScriptMap[key.id] ?? []);
    setError(null);
  }

  function closeForm() {
    setIsCreating(false);
    setEditing(null);
    setError(null);
  }

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
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const label = (formData.get("label") as string).trim();
    const expiresRaw = formData.get("expires_at") as string;
    const hwidResetLimit = Number(formData.get("hwid_reset_limit"));

    const payload = {
      label: label || undefined,
      expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
      hwid_reset_limit: Number.isFinite(hwidResetLimit)
        ? hwidResetLimit
        : undefined,
      script_ids: selectedScriptIds,
    };

    try {
      const res = await fetch("/api/admin/keys", {
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

  async function runAction(
    id: string,
    body: Record<string, unknown>,
  ) {
    setPendingActionId(id);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(key: KeyRow) {
    if (!window.confirm(`Delete key "${key.key_value}"? This cannot be undone.`)) {
      return;
    }

    setPendingActionId(key.id);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: key.id }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Keys</h1>
          <p className={styles.pageSubtitle}>
            Issue and manage whitelist keys — HWID binds on first validate.
          </p>
        </div>
        <Button type="button" onClick={openCreateForm}>
          New key
        </Button>
      </div>

      {formOpen ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          {editing ? (
            <p className={styles.editingKey}>{editing.key_value}</p>
          ) : null}

          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.label}>Label</span>
              <input
                name="label"
                type="text"
                defaultValue={editing?.label ?? ""}
                placeholder="e.g. discord: someuser"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Expires (blank = lifetime)</span>
              <input
                name="expires_at"
                type="date"
                defaultValue={toDateInputValue(editing?.expires_at ?? null)}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>HWID reset limit</span>
              <input
                name="hwid_reset_limit"
                type="number"
                min={0}
                defaultValue={editing?.hwid_reset_limit ?? defaultResetLimit}
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
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create key"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className={styles.filterRow}>
        <span className={styles.label}>Status</span>
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className={styles.input}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Label</th>
            <th>Status</th>
            <th>HWID</th>
            <th>Resets</th>
            <th>Last seen</th>
            <th>Expires</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {visibleKeys.map((key) => {
            const busy = pendingActionId === key.id;
            return (
              <tr key={key.id}>
                <td className={styles.mono}>{key.key_value}</td>
                <td>{key.label || "—"}</td>
                <td>
                  <Badge tone={STATUS_TONE[key.status]}>{key.status}</Badge>
                </td>
                <td className={styles.mono}>{key.hwid ?? "—"}</td>
                <td className={styles.mono}>
                  {key.hwid_resets}/{key.hwid_reset_limit}
                </td>
                <td className={`${styles.mono} ${styles.time}`}>
                  {formatDate(key.last_seen_at)}
                </td>
                <td className={`${styles.mono} ${styles.time}`}>
                  {key.expires_at ? formatDate(key.expires_at) : "Lifetime"}
                </td>
                <td className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => openEditForm(key)}
                  >
                    Edit
                  </button>
                  {key.status !== "active" ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={busy}
                      onClick={() => runAction(key.id, { status: "active" })}
                    >
                      Activate
                    </button>
                  ) : null}
                  {key.status !== "paused" ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={busy}
                      onClick={() => runAction(key.id, { status: "paused" })}
                    >
                      Pause
                    </button>
                  ) : null}
                  {key.status !== "banned" ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={busy}
                      onClick={() => runAction(key.id, { status: "banned" })}
                    >
                      Ban
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busy || !key.hwid}
                    onClick={() => runAction(key.id, { action: "reset-hwid" })}
                  >
                    Reset HWID
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busy}
                    onClick={() => handleDelete(key)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {visibleKeys.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.empty}>
                No keys match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
