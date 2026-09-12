"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import styles from "./panel.module.css";

export type PanelKeyRow = {
  id: string;
  key_value: string;
  status: "active" | "paused" | "banned" | "expired";
  hwid: string | null;
  hwid_resets: number;
  hwid_reset_limit: number;
  expires_at: string | null;
};

const STATUS_TONE: Record<
  PanelKeyRow["status"],
  "ok" | "warn" | "err" | "neutral"
> = {
  active: "ok",
  paused: "warn",
  banned: "err",
  expired: "neutral",
};

function formatExpiry(iso: string | null) {
  if (!iso) return "Lifetime";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function PanelView({ keys }: { keys: PanelKeyRow[] }) {
  const router = useRouter();
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [pendingResetId, setPendingResetId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkError(null);

    if (!linkValue.trim()) return;

    setIsLinking(true);
    try {
      const res = await fetch("/api/panel/link-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_value: linkValue.trim() }),
      });
      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setLinkError(json.error ?? "Could not link key.");
        return;
      }

      setLinkValue("");
      router.refresh();
    } finally {
      setIsLinking(false);
    }
  }

  async function handleUnlink(key: PanelKeyRow) {
    if (
      !window.confirm(
        `Unlink "${key.key_value}" from this account? You can re-link it later with the key.`,
      )
    ) {
      return;
    }

    setResetError(null);
    setPendingUnlinkId(key.id);
    try {
      const res = await fetch("/api/panel/link-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: key.id }),
      });
      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setResetError(json.error ?? "Could not unlink key.");
        return;
      }

      router.refresh();
    } finally {
      setPendingUnlinkId(null);
    }
  }

  async function handleResetHwid(keyId: string) {
    setResetError(null);
    setPendingResetId(keyId);
    try {
      const res = await fetch("/api/panel/reset-hwid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });
      const json: { error?: string } = await res.json();

      if (!res.ok) {
        setResetError(json.error ?? "Could not reset HWID.");
        return;
      }

      router.refresh();
    } finally {
      setPendingResetId(null);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle}>Your keys</h1>
        <button
          type="button"
          className={styles.linkButton}
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>

      <form onSubmit={handleLink} className={styles.linkForm}>
        <label className={styles.field}>
          <span className={styles.label}>Link a key to this account</span>
          <input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            type="text"
            placeholder="SYMBIOS-XXXX-XXXX-XXXX"
            className={styles.input}
          />
        </label>
        {linkError ? <p className={styles.error}>{linkError}</p> : null}
        <Button type="submit" disabled={isLinking}>
          {isLinking ? "Linking…" : "Link key"}
        </Button>
      </form>

      {resetError ? <p className={styles.error}>{resetError}</p> : null}

      <div className={styles.tableWrap}>
        <div className={styles.table}>
          <div className={styles.row}>
            <div className={styles.headerCell}>Key</div>
            <div className={styles.headerCell}>Status</div>
            <div className={styles.headerCell}>HWID</div>
            <div className={styles.headerCell}>Resets left</div>
            <div className={styles.headerCell}>Expires</div>
            <div className={styles.headerCell} aria-label="Actions" />
          </div>

          {keys.map((key) => {
            const resetsLeft = Math.max(
              key.hwid_reset_limit - key.hwid_resets,
              0,
            );
            return (
              <div key={key.id} className={styles.row}>
                <div className={`${styles.cell} ${styles.mono}`}>
                  {key.key_value}
                </div>
                <div className={styles.cell}>
                  <Badge tone={STATUS_TONE[key.status]}>{key.status}</Badge>
                </div>
                <div className={`${styles.cell} ${styles.mono}`}>
                  <HwidCell hwid={key.hwid} />
                </div>
                <div className={`${styles.cell} ${styles.mono}`}>
                  {resetsLeft}
                </div>
                <div className={`${styles.cell} ${styles.mono} ${styles.time}`}>
                  {formatExpiry(key.expires_at)}
                </div>
                <div className={styles.actionsCell}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={
                      pendingResetId === key.id || !key.hwid || resetsLeft <= 0
                    }
                    onClick={() => handleResetHwid(key.id)}
                  >
                    Reset HWID
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={pendingUnlinkId === key.id}
                    onClick={() => handleUnlink(key)}
                  >
                    Unlink
                  </button>
                </div>
              </div>
            );
          })}

          {keys.length === 0 ? (
            <div className={styles.empty}>
              No keys linked yet — link one above.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
