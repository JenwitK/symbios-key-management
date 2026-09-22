"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import { confirmDialog } from "@/lib/confirm";
import { toBangkokInputValue, fromBangkokInputValue } from "@/lib/datetime";
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
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryLifetime, setExpiryLifetime] = useState(false);

  const formOpen = isCreating || editing !== null;

  const visibleKeys = useMemo(() => {
    if (statusFilter === "all") return keys;
    return keys.filter((key) => key.status === statusFilter);
  }, [keys, statusFilter]);

  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedIds.has(key.id));

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const key of visibleKeys) next.delete(key.id);
      } else {
        for (const key of visibleKeys) next.add(key.id);
      }
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
    const keyValue = isCreating
      ? (formData.get("key_value") as string).trim()
      : "";

    const payload = {
      ...(keyValue ? { key_value: keyValue } : {}),
      label: label || undefined,
      expires_at: fromBangkokInputValue(expiresRaw),
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
    const ok = await confirmDialog({
      title: "Delete this key?",
      text: `"${key.key_value}" cannot be recovered after this.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

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

  async function runBulkAction(
    body: Record<string, unknown>,
    confirmOpts: { title: string; text?: string; confirmText: string; danger?: boolean },
  ) {
    const ok = await confirmDialog(confirmOpts);
    if (!ok) return;

    setBulkError(null);
    setIsBulkPending(true);
    try {
      const res = await fetch("/api/admin/keys/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), ...body }),
      });

      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setBulkError(json.error ?? "Bulk action failed.");
        return;
      }

      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setIsBulkPending(false);
    }
  }

  function handleBulkActivate() {
    const count = selectedIds.size;
    runBulkAction(
      { action: "set-status", status: "active" },
      {
        title: `Activate ${count} key${count === 1 ? "" : "s"}?`,
        text: "They will be able to validate again.",
        confirmText: "Activate",
      },
    );
  }

  function handleBulkBan() {
    const count = selectedIds.size;
    runBulkAction(
      { action: "set-status", status: "banned" },
      {
        title: `Ban ${count} key${count === 1 ? "" : "s"}?`,
        text: "They will stop validating immediately.",
        confirmText: "Ban",
        danger: true,
      },
    );
  }

  function handleBulkExtend() {
    if (!Number.isFinite(extendDays) || extendDays < 1 || extendDays > 3650) return;
    const count = selectedIds.size;
    runBulkAction(
      { action: "extend", days: extendDays },
      {
        title: `Extend ${count} key${count === 1 ? "" : "s"} by ${extendDays} day${extendDays === 1 ? "" : "s"}?`,
        text: "Expiry moves forward from now or their current expiry, whichever is later.",
        confirmText: "Extend",
      },
    );
  }

  function handleBulkSetExpiry() {
    if (!expiryLifetime && !expiryDate) return;
    const count = selectedIds.size;
    const expiresAt = expiryLifetime ? null : fromBangkokInputValue(expiryDate);

    runBulkAction(
      { action: "set-expiry", expires_at: expiresAt },
      {
        title: `Set expiry for ${count} key${count === 1 ? "" : "s"}?`,
        text: expiryLifetime
          ? "They will become lifetime keys."
          : `New expiry: ${formatDate(expiresAt)}`,
        confirmText: "Set expiry",
      },
    );
  }

  function handleBulkResetHwid() {
    const count = selectedIds.size;
    runBulkAction(
      { action: "reset-hwid" },
      {
        title: `Reset HWID for ${count} key${count === 1 ? "" : "s"}?`,
        text: "This clears the bound HWID and does not consume reset quota.",
        confirmText: "Reset HWID",
      },
    );
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    runBulkAction(
      { action: "delete" },
      {
        title: `Delete ${count} key${count === 1 ? "" : "s"}?`,
        text: "This cannot be undone.",
        confirmText: "Delete",
        danger: true,
      },
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Keys</h1>
          <p className={styles.pageSubtitle}>
            Issue and manage whitelist keys. HWID binds on first validate.
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
          ) : (
            <label className={styles.field}>
              <span className={styles.label}>Custom key (optional)</span>
              <input
                name="key_value"
                type="text"
                placeholder="blank = auto SYMBIOS-XXXX"
                className={styles.input}
              />
            </label>
          )}

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
                type="datetime-local"
                defaultValue={toBangkokInputValue(editing?.expires_at ?? null)}
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
          onChange={(event) => {
            setStatusFilter(event.target.value as StatusFilter);
            setSelectedIds(new Set());
          }}
          className={styles.input}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {selectedIds.size > 0 ? (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>

          <div className={styles.bulkActions}>
            <button
              type="button"
              className={styles.bulkButton}
              disabled={isBulkPending}
              onClick={handleBulkActivate}
            >
              Activate
            </button>
            <button
              type="button"
              className={styles.bulkButton}
              disabled={isBulkPending}
              onClick={handleBulkBan}
            >
              Ban
            </button>

            <div className={styles.bulkInlineGroup}>
              <input
                type="number"
                min={1}
                max={3650}
                value={extendDays}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (Number.isFinite(parsed)) {
                    setExtendDays(Math.min(3650, parsed));
                  }
                }}
                className={styles.bulkNumberInput}
              />
              <button
                type="button"
                className={styles.bulkButton}
                disabled={
                  isBulkPending ||
                  !Number.isFinite(extendDays) ||
                  extendDays < 1 ||
                  extendDays > 3650
                }
                onClick={handleBulkExtend}
              >
                Extend (days)
              </button>
            </div>

            <div className={styles.bulkInlineGroup}>
              <label className={styles.bulkCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={expiryLifetime}
                  onChange={(event) => setExpiryLifetime(event.target.checked)}
                  className={styles.checkbox}
                />
                Lifetime
              </label>
              {!expiryLifetime ? (
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(event) => setExpiryDate(event.target.value)}
                  className={styles.bulkDateInput}
                />
              ) : null}
              <button
                type="button"
                className={styles.bulkButton}
                disabled={isBulkPending || (!expiryLifetime && !expiryDate)}
                onClick={handleBulkSetExpiry}
              >
                Set expiry
              </button>
            </div>

            <button
              type="button"
              className={styles.bulkButton}
              disabled={isBulkPending}
              onClick={handleBulkResetHwid}
            >
              Reset HWID
            </button>
            <button
              type="button"
              className={`${styles.bulkButton} ${styles.bulkButtonDanger}`}
              disabled={isBulkPending}
              onClick={handleBulkDelete}
            >
              Delete
            </button>
          </div>

          {bulkError ? <p className={styles.error}>{bulkError}</p> : null}
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.headerRow}`}>
            <div className={styles.headerCell}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className={styles.checkbox}
                aria-label="Select all"
              />
            </div>
            <div className={styles.headerCell}>Key</div>
            <div className={styles.headerCell}>Label</div>
            <div className={styles.headerCell}>Status</div>
            <div className={styles.headerCell}>HWID</div>
            <div className={styles.headerCell}>Resets</div>
            <div className={styles.headerCell}>Last seen</div>
            <div className={styles.headerCell}>Expires</div>
            <div className={styles.headerCell} aria-label="Actions" />
          </div>

          {visibleKeys.map((key) => {
            const busy = pendingActionId === key.id;
            return (
              <div key={key.id} className={styles.row}>
                <div className={styles.cell} data-label="Select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(key.id)}
                    onChange={() => toggleSelectOne(key.id)}
                    className={styles.checkbox}
                    aria-label={`Select ${key.key_value}`}
                  />
                </div>
                <div className={`${styles.cell} ${styles.mono}`} data-label="Key">
                  <Link href={`/dashboard/keys/${key.id}`} className={styles.keyLink}>
                    {key.key_value}
                  </Link>
                </div>
                <div className={styles.cell} data-label="Label">
                  {key.label || "-"}
                </div>
                <div className={styles.cell} data-label="Status">
                  <Badge tone={STATUS_TONE[key.status]}>{key.status}</Badge>
                </div>
                <div className={`${styles.cell} ${styles.mono}`} data-label="HWID">
                  <HwidCell hwid={key.hwid} />
                </div>
                <div className={`${styles.cell} ${styles.mono}`} data-label="Resets">
                  {key.hwid_resets}/{key.hwid_reset_limit}
                </div>
                <div
                  className={`${styles.cell} ${styles.mono} ${styles.time}`}
                  data-label="Last seen"
                >
                  {formatDate(key.last_seen_at)}
                </div>
                <div
                  className={`${styles.cell} ${styles.mono} ${styles.time}`}
                  data-label="Expires"
                >
                  {key.expires_at ? formatDate(key.expires_at) : "Lifetime"}
                </div>
                <div className={styles.actionsCell}>
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
                </div>
              </div>
            );
          })}

          {visibleKeys.length === 0 ? (
            <div className={styles.empty}>No keys match this filter.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
