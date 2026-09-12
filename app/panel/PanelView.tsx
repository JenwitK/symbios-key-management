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

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Status</th>
            <th>HWID</th>
            <th>Resets left</th>
            <th>Expires</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const resetsLeft = Math.max(
              key.hwid_reset_limit - key.hwid_resets,
              0,
            );
            return (
              <tr key={key.id}>
                <td className={styles.mono}>{key.key_value}</td>
                <td>
                  <Badge tone={STATUS_TONE[key.status]}>{key.status}</Badge>
                </td>
                <td className={styles.mono}>
                  <HwidCell hwid={key.hwid} />
                </td>
                <td className={styles.mono}>{resetsLeft}</td>
                <td className={`${styles.mono} ${styles.time}`}>
                  {formatExpiry(key.expires_at)}
                </td>
                <td>
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
                </td>
              </tr>
            );
          })}
          {keys.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                No keys linked yet — link one above.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
