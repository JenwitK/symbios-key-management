"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SyncActions = {
  setLive: (live: boolean) => void;
  markSynced: () => void;
};

type SyncStatus = {
  live: boolean;
  lastSync: number;
};

const SyncActionsContext = createContext<SyncActions | null>(null);
const SyncStatusContext = createContext<SyncStatus | null>(null);

/** Stable across renders: safe to depend on from a poller's effect deps. */
export function useSyncActions(): SyncActions {
  const ctx = useContext(SyncActionsContext);
  if (!ctx) {
    throw new Error("useSyncActions must be used within SyncProvider");
  }
  return ctx;
}

/** Changes whenever live/lastSync change: only the topbar pill should read this. */
export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    throw new Error("useSyncStatus must be used within SyncProvider");
  }
  return ctx;
}

export function formatSyncAgo(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 2) return "synced now";
  if (seconds < 60) return `synced ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `synced ${minutes}m ago`;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState(false);
  const [lastSync, setLastSync] = useState(() => Date.now());

  const markSynced = useCallback(() => setLastSync(Date.now()), []);

  // Split so the 1s ticker (which only the topbar pill needs) never causes
  // pollers subscribed to actions-only to re-render.
  const actions = useMemo<SyncActions>(() => ({ setLive, markSynced }), [markSynced]);
  const status = useMemo<SyncStatus>(() => ({ live, lastSync }), [live, lastSync]);

  return (
    <SyncActionsContext.Provider value={actions}>
      <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>
    </SyncActionsContext.Provider>
  );
}
