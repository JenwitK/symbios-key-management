"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import { confirmDialog } from "@/lib/confirm";
import styles from "./announcement.module.css";

export type AnnouncementRow = {
  id: string;
  tag: string | null;
  title: string | null;
  body: string | null;
  games: number[] | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
};

type AnnouncementManagerProps = {
  entries: AnnouncementRow[];
};

function bodyPreview(body: string | null) {
  if (!body) return "-";
  const trimmed = body.trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 60)}...`;
}

function formatGames(games: number[] | null) {
  if (!games || games.length === 0) return "All games";
  return games.join(", ");
}

export function AnnouncementManager({ entries }: AnnouncementManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
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

    const gamesRaw = (formData.get("games") as string).trim();
    const gamesParsed = gamesRaw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const games = gamesParsed.length > 0 ? gamesParsed : null;

    const sortOrderRaw = Number(formData.get("sort_order"));

    const payload = {
      tag: formData.get("tag"),
      title: formData.get("title"),
      body: formData.get("body"),
      games,
      enabled: formData.get("enabled") === "on",
      sort_order: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
    };

    try {
      const res = await fetch("/api/admin/announcement", {
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

  async function handleDelete(entry: AnnouncementRow) {
    const ok = await confirmDialog({
      title: "Delete this announcement?",
      text: `"${entry.title || entry.tag || "This announcement"}" cannot be recovered after this.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch("/api/admin/announcement", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id }),
    });

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Announcement</h1>
          <p className={styles.pageSubtitle}>
            Served to the loader by /api/v1/announcement.
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
          New announcement
        </Button>
      </div>

      {formOpen ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span className={styles.label}>Tag</span>
              <input
                name="tag"
                type="text"
                defaultValue={editing?.tag ?? ""}
                placeholder="e.g. update"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Title</span>
              <input
                name="title"
                type="text"
                defaultValue={editing?.title ?? ""}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Sort order</span>
              <input
                name="sort_order"
                type="number"
                defaultValue={editing?.sort_order ?? 0}
                className={styles.input}
              />
            </label>
          </div>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={editing?.enabled ?? true}
            />
            Enabled
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Body</span>
            <textarea
              name="body"
              defaultValue={editing?.body ?? ""}
              rows={5}
              className={styles.textarea}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Games</span>
            <input
              name="games"
              type="text"
              defaultValue={editing?.games ? editing.games.join(", ") : ""}
              placeholder="blank = all games"
              className={styles.input}
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.formActions}>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create announcement"}
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
            <div className={styles.headerCell}>Tag</div>
            <div className={styles.headerCell}>Title</div>
            <div className={styles.headerCell}>Body</div>
            <div className={styles.headerCell}>Games</div>
            <div className={styles.headerCell}>Enabled</div>
            <div className={styles.headerCell}>Sort</div>
            <div className={styles.headerCell} aria-label="Actions" />
          </div>

          {entries.map((entry) => (
            <div key={entry.id} className={styles.row}>
              <div className={styles.cell}>
                {entry.tag ? (
                  <Badge tone="neutral">{entry.tag}</Badge>
                ) : (
                  <span className={styles.mono}>-</span>
                )}
              </div>
              <div className={styles.cell}>{entry.title || "-"}</div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {bodyPreview(entry.body)}
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {formatGames(entry.games)}
              </div>
              <div className={styles.cell}>
                <Badge tone={entry.enabled ? "ok" : "neutral"}>
                  {entry.enabled ? "enabled" : "disabled"}
                </Badge>
              </div>
              <div className={`${styles.cell} ${styles.mono}`}>
                {entry.sort_order}
              </div>
              <div className={styles.actionsCell}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setEditing(entry);
                    setIsCreating(false);
                    setError(null);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => handleDelete(entry)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {entries.length === 0 ? (
            <div className={styles.empty}>No announcements yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
