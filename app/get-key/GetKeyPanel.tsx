"use client";

import { useState } from "react";
import { Button } from "@/components/Button/Button";
import { Badge } from "@/components/Badge/Badge";
import styles from "./get-key.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "That redeem link is incomplete.",
  invalid_session: "That redeem session doesn't exist. Start again.",
  session_used: "That redeem link was already used.",
  session_expired: "That redeem session expired — start again.",
  ip_mismatch: "Finish the redeem from the same network you started it on.",
  no_provider: "Redeem is temporarily unavailable — no provider is enabled.",
  verification_failed: "We couldn't verify you completed the step. Try again.",
  issue_failed: "Something went wrong issuing your key. Try again.",
};

type GetKeyPanelProps = {
  issuedKey: string | null;
  error: string | null;
  providerId: string | null;
};

export function GetKeyPanel({ issuedKey, error, providerId }: GetKeyPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleStart() {
    setStartError(null);
    setIsStarting(true);

    try {
      const res = await fetch("/api/redeem/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json: { success?: boolean; link?: string; error?: string } =
        await res.json();

      if (!res.ok || !json.success || !json.link) {
        setStartError(json.error ?? "Could not start redeem.");
        return;
      }

      window.location.href = json.link;
    } finally {
      setIsStarting(false);
    }
  }

  if (issuedKey) {
    return (
      <div className={styles.panel}>
        <Badge tone="ok">Key issued</Badge>
        <p className={styles.copy}>
          Your key — copy it now, it won&apos;t be shown here again:
        </p>
        <p className={styles.keyValue}>{issuedKey}</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Badge tone={providerId ? "neutral" : "warn"}>
        {providerId ? `Redeem via ${providerId}` : "Redeem unavailable"}
      </Badge>

      <p className={styles.copy}>
        Complete the step to get a free key. Your HWID binds automatically
        the first time you use it in-game.
      </p>

      {error ? (
        <p className={styles.error}>
          {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
        </p>
      ) : null}

      {startError ? <p className={styles.error}>{startError}</p> : null}

      <Button
        type="button"
        onClick={handleStart}
        disabled={isStarting || !providerId}
      >
        {isStarting ? "Starting…" : "Start"}
      </Button>
    </div>
  );
}
