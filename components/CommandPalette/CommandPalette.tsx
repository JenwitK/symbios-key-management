"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Wrench,
  Zap,
  Bell,
  ChevronUp,
  ChevronDown,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/app/(admin)/dashboard/nav";
import { useMaintenanceToggle } from "@/lib/useMaintenanceToggle";
import { useToast } from "@/components/Toast/ToastProvider";
import { expiryCountdown } from "@/lib/datetime";
import { useCommandPalette } from "./CommandPaletteContext";
import styles from "./CommandPalette.module.css";

type KeySearchResult = {
  id: string;
  key_value: string;
  status: "active" | "paused" | "banned" | "expired";
  label: string | null;
  discord_id: string | null;
  expires_at: string | null;
};

type PaletteGroup = "Jump to" | "Actions" | "Keys";

type PaletteEntry = {
  group: PaletteGroup;
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: string[];
  meta?: string;
  run: () => void;
};

// Keyed by event.code (physical key), not event.key, so shortcuts work
// regardless of the active keyboard layout (e.g. Thai maps KeyK to "า").
const JUMP_SHORTCUTS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.filter((item) => item.shortcut).map((item) => [
    `Key${(item.shortcut as string).toUpperCase()}`,
    item.href,
  ]),
);

const SEARCH_DEBOUNCE_MS = 200;
const G_WINDOW_MS = 1000;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isConfirmDialogOpen(): boolean {
  return document.body.classList.contains("swal2-shown");
}

function highlight(label: string, query: string): ReactNode {
  if (!query) return label;
  const idx = label.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className={styles.match}>{label.slice(idx, idx + query.length)}</mark>
      {label.slice(idx + query.length)}
    </>
  );
}

export function CommandPalette({ initialMaintenance }: { initialMaintenance: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { toggle: toggleMaintenance } = useMaintenanceToggle(initialMaintenance);
  const { open, openPalette: contextOpen, closePalette: contextClose } = useCommandPalette();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [keyResults, setKeyResults] = useState<KeySearchResult[]>([]);
  const [keyResultsQuery, setKeyResultsQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const gPressedAtRef = useRef<number | null>(null);

  const runValidate = useCallback(() => router.push("/dashboard/playground"), [router]);

  const sendTestAlert = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json: { error?: string } = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Could not send the test alert.", "err");
        return;
      }
      showToast("Test alert sent, check Discord");
    } catch {
      showToast("Could not reach the server.", "err");
    }
  }, [showToast]);

  const jumpEntries = useMemo<PaletteEntry[]>(
    () =>
      NAV_ITEMS.map((item) => ({
        group: "Jump to",
        id: `jump-${item.href}`,
        label: item.label,
        icon: item.icon,
        hint: item.shortcut ? ["G", item.shortcut.toUpperCase()] : undefined,
        run: () => router.push(item.href),
      })),
    [router],
  );

  const actionEntries = useMemo<PaletteEntry[]>(
    () => [
      {
        group: "Actions",
        id: "action-new-key",
        label: "Create key",
        icon: Plus,
        hint: ["N"],
        run: () => router.push("/dashboard/keys?new=1"),
      },
      {
        group: "Actions",
        id: "action-bulk",
        label: "Generate bulk keys",
        icon: Plus,
        run: () => router.push("/dashboard/bulk"),
      },
      {
        group: "Actions",
        id: "action-maintenance",
        label: "Toggle maintenance",
        icon: Wrench,
        run: () => {
          void toggleMaintenance();
        },
      },
      {
        group: "Actions",
        id: "action-validate",
        label: "Test validate in Playground",
        icon: Zap,
        run: runValidate,
      },
      {
        group: "Actions",
        id: "action-alert",
        label: "Send test Discord alert",
        icon: Bell,
        run: () => {
          void sendTestAlert();
        },
      },
    ],
    [router, runValidate, sendTestAlert, toggleMaintenance],
  );

  const trimmedQuery = query.trim();

  const filteredJump = useMemo(() => {
    if (!trimmedQuery) return jumpEntries;
    const q = trimmedQuery.toLowerCase();
    return jumpEntries.filter((entry) => entry.label.toLowerCase().includes(q));
  }, [jumpEntries, trimmedQuery]);

  const filteredActions = useMemo(() => {
    if (!trimmedQuery) return actionEntries;
    const q = trimmedQuery.toLowerCase();
    return actionEntries.filter((entry) => entry.label.toLowerCase().includes(q));
  }, [actionEntries, trimmedQuery]);

  const keyEntries = useMemo<PaletteEntry[]>(() => {
    if (trimmedQuery.length < 2) return [];
    // Results are stamped with the query they answer; a query change makes
    // them stale immediately (shows "Searching..." instead of old matches)
    // rather than waiting for the in-flight request to resolve.
    if (keyResultsQuery !== trimmedQuery) return [];
    return keyResults.map((key) => {
      const identity = key.label || key.discord_id || null;
      const statusPart =
        key.status !== "active" ? key.status : (expiryCountdown(key.expires_at) ?? "Lifetime");
      const meta = identity ? `${identity} · ${statusPart}` : statusPart;
      return {
        group: "Keys",
        id: `key-${key.id}`,
        label: key.key_value,
        icon: KeyRound,
        meta,
        run: () => router.push(`/dashboard/keys/${key.id}`),
      };
    });
  }, [keyResults, keyResultsQuery, router, trimmedQuery]);

  const shown = useMemo(
    () => [...filteredJump, ...filteredActions, ...keyEntries],
    [filteredJump, filteredActions, keyEntries],
  );

  // Derived at render time instead of synced via effect: `selected` can be
  // transiently out of range right after the list shrinks (e.g. search
  // results arriving), so clamp on read rather than storing a clamped copy.
  const activeIndex = shown.length ? Math.min(selected, shown.length - 1) : 0;

  const close = useCallback(() => {
    contextClose();
    restoreFocusRef.current?.focus();
  }, [contextClose]);

  // Reset transient palette state whenever it opens, no matter which caller
  // (sidebar button, Cmd/Ctrl+K, "/") flipped it open. Derived during render
  // per React's "adjusting state when a prop changes" pattern, since these
  // are direct resets keyed off the `open` transition.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setSelected(0);
      setKeyResults([]);
    }
  }

  // Focus management is a genuine DOM side effect, so it stays in an effect
  // (no setState here, only ref writes and a focus() call).
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [open]);

  // Debounced key search. Below 2 chars, keyEntries already derives to []
  // regardless of stale keyResults, so there is nothing to reset here.
  // isSearching(true) is set from the input's onChange, not here, since an
  // effect body should not call setState synchronously.
  useEffect(() => {
    if (trimmedQuery.length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/admin/keys/search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((json: { keys?: KeySearchResult[] }) => {
          // Ignore a response that is no longer the latest request in
          // flight (a newer query already replaced this AbortController).
          if (abortRef.current !== controller) return;
          setKeyResults(json.keys ?? []);
          setKeyResultsQuery(trimmedQuery);
        })
        .catch(() => {
          // aborted or network error: leave previous results
        })
        .finally(() => {
          if (abortRef.current !== controller) return;
          setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const run = useCallback(
    (entry: PaletteEntry) => {
      close();
      entry.run();
    },
    [close],
  );

  // Global shortcuts: Cmd/Ctrl+K, "/", N, G-then-letter.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // A SweetAlert2 confirm dialog owns keyboard input while it is open:
      // no shortcut, including Cmd/Ctrl+K, should fire underneath it.
      if (isConfirmDialogOpen()) return;

      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") {
        event.preventDefault();
        if (open) {
          close();
        } else {
          contextOpen();
        }
        return;
      }

      if (open) return;

      if (isTypingTarget(event.target)) return;

      const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      if (hasModifier) return;

      if (event.code === "Slash") {
        event.preventDefault();
        contextOpen();
        return;
      }

      if (event.code === "KeyN") {
        event.preventDefault();
        router.push("/dashboard/keys?new=1");
        return;
      }

      if (event.code === "KeyG") {
        gPressedAtRef.current = Date.now();
        return;
      }

      const pressedAt = gPressedAtRef.current;
      if (pressedAt && Date.now() - pressedAt < G_WINDOW_MS) {
        const href = JUMP_SHORTCUTS[event.code];
        gPressedAtRef.current = null;
        if (href) {
          event.preventDefault();
          router.push(href);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close, contextOpen, router]);

  // In-palette keyboard nav + focus trap.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((current) => (shown.length ? (current + 1) % shown.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) =>
          shown.length ? (current - 1 + shown.length) % shown.length : 0,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const entry = shown[activeIndex];
        if (entry) run(entry);
      } else if (event.key === "Tab") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, shown, activeIndex, close, run]);

  useEffect(() => {
    listRef.current?.querySelector(`.${styles.sel}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let lastGroup: PaletteGroup | null = null;

  return (
    <div
      className={open ? `${styles.scrim} ${styles.open}` : styles.scrim}
      aria-hidden={!open}
      inert={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className={styles.palInput}>
          <Search size={16} strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setSelected(0);
              if (value.trim().length >= 2) setIsSearching(true);
            }}
            placeholder="Search pages, actions, keys..."
            autoComplete="off"
            spellCheck={false}
          />
          <span className={styles.kbd}>ESC</span>
        </div>

        <div
          className={styles.palList}
          ref={listRef}
          onClick={(event) => {
            const row = (event.target as HTMLElement).closest("[data-index]");
            if (!row) return;
            const entry = shown[Number(row.getAttribute("data-index"))];
            if (entry) run(entry);
          }}
        >
          {shown.length === 0 ? (
            isSearching && trimmedQuery.length >= 2 ? (
              <div className={styles.palEmpty}>Searching...</div>
            ) : (
              <div className={styles.palEmpty}>No results for &quot;{trimmedQuery}&quot;</div>
            )
          ) : (
            shown.map((entry, index) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              const Icon = entry.icon;
              return (
                <div key={entry.id}>
                  {showGroup ? <div className={styles.palGroup}>{entry.group}</div> : null}
                  <div
                    data-index={index}
                    className={
                      index === activeIndex ? `${styles.palItem} ${styles.sel}` : styles.palItem
                    }
                    onMouseMove={() => {
                      if (index !== activeIndex) setSelected(index);
                    }}
                  >
                    <Icon size={15} strokeWidth={1.6} />
                    <span>{highlight(entry.label, trimmedQuery)}</span>
                    {entry.meta ? (
                      <span className={styles.meta}>{entry.meta}</span>
                    ) : entry.hint ? (
                      <span className={styles.meta}>
                        {entry.hint.map((key) => (
                          <span key={key} className={styles.kbd}>
                            {key}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.palFoot}>
          <span>
            <span className={styles.kbd}>
              <ChevronUp size={10} />
            </span>
            <span className={styles.kbd}>
              <ChevronDown size={10} />
            </span>
            navigate
          </span>
          <span>
            <span className={styles.kbd}>Enter</span>open
          </span>
          <span>
            <span className={styles.kbd}>Ctrl K</span>toggle
          </span>
        </div>
      </div>
    </div>
  );
}
