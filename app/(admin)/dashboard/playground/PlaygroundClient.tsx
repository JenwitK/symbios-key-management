"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import styles from "./playground.module.css";

type PlaygroundClientProps = {
  slugs: string[];
};

type LoaderResponse =
  | { success: true; script: string }
  | { success: false; reason: string };

type TestResult = {
  result: string;
  httpStatus: number;
  loaderResponse: LoaderResponse;
  scriptChars: number | null;
  hwidNote: string | null;
  trace: string[];
};

const CUSTOM_SLUG = "__custom__";

function randomHwid() {
  const raw = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `HWID-${raw.slice(0, 16)}`;
}

function resultTone(result: string): "ok" | "err" | "neutral" {
  if (result === "ok") return "ok";
  if (result === "server_error") return "err";
  return "neutral";
}

export function PlaygroundClient({ slugs }: PlaygroundClientProps) {
  const [selectValue, setSelectValue] = useState(slugs[0] ?? CUSTOM_SLUG);
  const [customSlug, setCustomSlug] = useState("");
  const [key, setKey] = useState("");
  const [hwid, setHwid] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const scriptSlug = selectValue === CUSTOM_SLUG ? customSlug : selectValue;

  async function handleRun() {
    if (!scriptSlug.trim() || !hwid.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/validate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim() || undefined,
          hwid: hwid.trim(),
          script_slug: scriptSlug.trim(),
        }),
      });

      const json: TestResult & { error?: string } = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Request failed.");
        return;
      }

      setResult(json);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Validate playground</h1>
          <p className={styles.pageSubtitle}>
            Simulate a loader call to /api/v1/validate.
          </p>
        </div>
      </div>

      <p className={styles.notice}>
        Read-only. This does not bind HWID or write logs.
      </p>

      <div className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span className={styles.label}>Script slug</span>
            <select
              value={selectValue}
              onChange={(event) => setSelectValue(event.target.value)}
              className={styles.input}
            >
              {slugs.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
              <option value={CUSTOM_SLUG}>Custom slug...</option>
            </select>
          </label>

          {selectValue === CUSTOM_SLUG ? (
            <label className={styles.field}>
              <span className={styles.label}>Custom slug</span>
              <input
                value={customSlug}
                onChange={(event) => setCustomSlug(event.target.value)}
                type="text"
                placeholder="my-script"
                className={styles.input}
              />
            </label>
          ) : null}

          <label className={styles.field}>
            <span className={styles.label}>Key (optional)</span>
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              type="text"
              placeholder="SYMBIOS-XXXX-XXXX-XXXX"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>HWID</span>
            <div className={styles.hwidRow}>
              <input
                value={hwid}
                onChange={(event) => setHwid(event.target.value)}
                type="text"
                placeholder="HWID-..."
                className={styles.input}
              />
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setHwid(randomHwid())}
              >
                Random
              </button>
            </div>
          </label>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.formActions}>
          <Button
            type="button"
            disabled={isRunning || !scriptSlug.trim() || !hwid.trim()}
            onClick={handleRun}
          >
            {isRunning ? "Running..." : "Run test"}
          </Button>
        </div>
      </div>

      {result ? (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <Badge tone={resultTone(result.result)}>{result.result}</Badge>
            <span className={styles.mono}>HTTP {result.httpStatus}</span>
            {result.scriptChars !== null ? (
              <span className={styles.mono}>{result.scriptChars} chars</span>
            ) : null}
          </div>

          {result.hwidNote ? (
            <p className={styles.hwidNote}>{result.hwidNote}</p>
          ) : null}

          <div className={styles.resultBlock}>
            <span className={styles.blockLabel}>Loader response</span>
            <pre className={styles.pre}>
              {JSON.stringify(result.loaderResponse, null, 2)}
            </pre>
          </div>

          <div className={styles.resultBlock}>
            <span className={styles.blockLabel}>Trace</span>
            <ol className={styles.trace}>
              {result.trace.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
