"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import { HwidCell } from "@/components/HwidCell/HwidCell";
import { CodeBlock } from "@/components/CodeBlock/CodeBlock";
import { confirmDialog } from "@/lib/confirm";
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

export type ScriptAccess = {
  name: string;
  slug: string;
};

export type AnnouncementRow = {
  tag: string | null;
  title: string;
  body: string;
};

type PanelViewProps = {
  keys: PanelKeyRow[];
  scriptsByKey: Record<string, ScriptAccess[]>;
  announcements: AnnouncementRow[];
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

const LOADER = `loadstring(game:HttpGet("https://raw.githubusercontent.com/SYMBIOSHUB/SYMBIOS-HUB/refs/heads/main/SYMBIOS.lua"))()`;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatExpiry(iso: string | null) {
  if (!iso) return "Lifetime";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function expiryCountdown(iso: string | null) {
  if (!iso) return null;
  const diffDays = Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY);
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function nextExpiryLabel(keys: PanelKeyRow[]) {
  const now = Date.now();
  const future = keys
    .map((key) => (key.expires_at ? new Date(key.expires_at).getTime() : null))
    .filter((time): time is number => time !== null && time > now)
    .sort((a, b) => a - b);

  if (future.length === 0) return "Lifetime";
  const diffDays = Math.ceil((future[0] - now) / MS_PER_DAY);
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function PanelView({ keys, scriptsByKey, announcements }: PanelViewProps) {
  const router = useRouter();
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [pendingResetId, setPendingResetId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const ok = await confirmDialog({
      title: "Unlink this key?",
      text: `You can re-link "${key.key_value}" to this account later with the key.`,
      confirmText: "Unlink",
      danger: true,
    });
    if (!ok) return;
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

  async function handleCopyKey(key: PanelKeyRow) {
    try {
      await navigator.clipboard.writeText(key.key_value);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId((current) => (current === key.id ? null : current)), 1500);
    } catch {
      // clipboard denied, nothing to do
    }
  }

  const activeCount = keys.filter((key) => key.status === "active").length;
  const resetsLeftTotal = keys.reduce(
    (sum, key) => sum + Math.max(key.hwid_reset_limit - key.hwid_resets, 0),
    0,
  );

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle}>Your keys</h1>
        <button type="button" className={styles.linkButton} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {keys.length > 0 ? (
        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total keys</span>
            <span className={styles.statValue}>{keys.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active</span>
            <span className={styles.statValue}>{activeCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Resets left</span>
            <span className={styles.statValue}>{resetsLeftTotal}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Next expiry</span>
            <span className={styles.statValue}>{nextExpiryLabel(keys)}</span>
          </div>
        </div>
      ) : null}

      <div className={styles.mainGrid}>
        <div className={styles.main}>
          <form onSubmit={handleLink} className={styles.linkForm}>
            <span className={styles.label}>Link a key to this account</span>
            <div className={styles.linkRow}>
              <input
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                type="text"
                placeholder="SYMBIOS-XXXX-XXXX-XXXX"
                className={styles.input}
              />
              <Button type="submit" disabled={isLinking}>
                {isLinking ? "Linking…" : "Link key"}
              </Button>
            </div>
            {linkError ? <p className={styles.error}>{linkError}</p> : null}
          </form>

          {resetError ? <p className={styles.error}>{resetError}</p> : null}

          <div className={styles.cardsWrap}>
            {keys.map((key) => {
              const resetsLeft = Math.max(key.hwid_reset_limit - key.hwid_resets, 0);
              const countdown = expiryCountdown(key.expires_at);
              const scripts = scriptsByKey[key.id] ?? [];

              return (
                <div key={key.id} className={styles.keyCard}>
                  <div className={styles.keyCardHeader}>
                    <div className={styles.keyValueRow}>
                      <span className={styles.keyValue}>{key.key_value}</span>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() => handleCopyKey(key)}
                      >
                        {copiedId === key.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <Badge tone={STATUS_TONE[key.status]}>{key.status}</Badge>
                  </div>

                  <div className={styles.keyCardBody}>
                    <div className={styles.keyStat}>
                      <span className={styles.keyStatLabel}>HWID</span>
                      <span className={styles.mono}>
                        <HwidCell hwid={key.hwid} />
                      </span>
                    </div>
                    <div className={styles.keyStat}>
                      <span className={styles.keyStatLabel}>Resets left</span>
                      <span className={styles.mono}>{resetsLeft}</span>
                    </div>
                    <div className={styles.keyStat}>
                      <span className={styles.keyStatLabel}>Expires</span>
                      <span className={styles.mono}>
                        {formatExpiry(key.expires_at)}
                        {countdown ? ` (${countdown})` : ""}
                      </span>
                    </div>
                  </div>

                  <div className={styles.scriptAccess}>
                    <span className={styles.keyStatLabel}>Script access</span>
                    {scripts.length > 0 ? (
                      <div className={styles.chipRow}>
                        {scripts.map((script) => (
                          <span key={script.slug} className={styles.chip}>
                            {script.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.muted}>No scripts</span>
                    )}
                  </div>

                  <div className={styles.keyCardActions}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={pendingResetId === key.id || !key.hwid || resetsLeft <= 0}
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
              <div className={styles.empty}>No keys linked yet. Link one above.</div>
            ) : null}
          </div>
        </div>

        <aside className={styles.aside}>
          <section className={styles.howto}>
            <h2 className={styles.sectionTitle}>How to use your key</h2>
            <ol className={styles.steps}>
              <li>Copy the loader below.</li>
              <li>Paste it into your executor and run it.</li>
              <li>Enter your key when prompted (keyless scripts just run).</li>
            </ol>
            <CodeBlock filename="symbios-loader.lua" code={LOADER} />
          </section>

          {announcements.length > 0 ? (
            <section className={styles.news}>
              <h2 className={styles.sectionTitle}>News</h2>
              <div className={styles.newsList}>
                {announcements.map((item, index) => (
                  <div key={index} className={styles.newsCard}>
                    <div className={styles.newsHeader}>
                      {item.tag ? <Badge tone="neutral">{item.tag}</Badge> : null}
                      <span className={styles.newsTitle}>{item.title}</span>
                    </div>
                    <p className={styles.newsBody}>{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
