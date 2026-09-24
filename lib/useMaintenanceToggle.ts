"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { confirmDialog } from "@/lib/confirm";
import { useToast } from "@/components/Toast/ToastProvider";

/**
 * Shared by the Sidebar switch and the command palette action so both read
 * and write the same real kill-switch (settings.maintenance). Local state is
 * optimistic and rolls back on API failure; it also re-syncs from
 * `initialMaintenance` after router.refresh() re-fetches the true value, so
 * a toggle in one place is reflected in the other once the refresh lands.
 * Re-synced during render (not an effect) per React's "adjusting state when
 * a prop changes" pattern, since this is a direct prop mirror.
 */
export function useMaintenanceToggle(initialMaintenance: boolean) {
  const router = useRouter();
  const { showToast } = useToast();
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [syncedFrom, setSyncedFrom] = useState(initialMaintenance);
  const [isPending, setIsPending] = useState(false);

  if (initialMaintenance !== syncedFrom) {
    setSyncedFrom(initialMaintenance);
    setMaintenance(initialMaintenance);
  }

  const toggle = useCallback(async () => {
    const turningOn = !maintenance;

    const ok = await confirmDialog({
      title: turningOn ? "Turn maintenance mode on?" : "Turn maintenance mode off?",
      text: turningOn
        ? "Every loader call will show UNDER MAINTENANCE until you turn this off."
        : "Loaders will validate normally again.",
      confirmText: turningOn ? "Turn on" : "Turn off",
      danger: turningOn,
    });
    if (!ok) return;

    const previous = maintenance;
    setMaintenance(turningOn);
    setIsPending(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance: turningOn }),
      });

      if (!res.ok) {
        setMaintenance(previous);
        const json: { error?: string } = await res.json().catch(() => ({}));
        showToast(json.error ?? "Could not update maintenance mode.", "err");
        return;
      }

      showToast(turningOn ? "Maintenance mode on" : "Maintenance mode off");
      router.refresh();
    } catch {
      setMaintenance(previous);
      showToast("Could not reach the server.", "err");
    } finally {
      setIsPending(false);
    }
  }, [maintenance, router, showToast]);

  return { maintenance, toggle, isPending };
}
