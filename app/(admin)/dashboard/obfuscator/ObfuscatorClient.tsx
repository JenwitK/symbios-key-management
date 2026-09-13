"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import type {
  MoonveilAccount,
  CompileType,
  VmType,
  SafeEnvLock,
} from "@/lib/moonveil";
import styles from "./obfuscator.module.css";

type Mode = "obf" | "prettify" | "minify";

const MODES: { value: Mode; label: string }[] = [
  { value: "obf", label: "Obfuscate" },
  { value: "prettify", label: "Prettify" },
  { value: "minify", label: "Minify" },
];

const COMPILE_TYPES: CompileType[] = ["cff", "vm", "safeEnv"];
const VM_TYPES: VmType[] = ["fox", "skid"];
const SAFE_ENV_LOCKS: SafeEnvLock[] = ["luau", "rbx"];

type RunError = {
  message: string;
  retryAfter?: number;
};

export function ObfuscatorClient() {
  const [account, setAccount] = useState<MoonveilAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("obf");
  const [script, setScript] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<RunError | null>(null);
  const [copied, setCopied] = useState(false);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [compileType, setCompileType] = useState<CompileType>("cff");
  const [vmType, setVmType] = useState<VmType>("skid");
  const [safeEnvLock, setSafeEnvLock] = useState<SafeEnvLock>("luau");
  const [cffDecompose, setCffDecompose] = useState(false);
  const [cffMangleNext, setCffMangleNext] = useState(false);
  const [cffMangleStrings, setCffMangleStrings] = useState(false);
  const [cffMangleGlobals, setCffMangleGlobals] = useState(false);
  const [cffMangleCfPercent, setCffMangleCfPercent] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      try {
        const res = await fetch("/api/admin/obf");
        const json: { account?: MoonveilAccount; error?: string } = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setAccountError(json.error ?? "Could not load MoonVeil account.");
          return;
        }
        setAccount(json.account ?? null);
      } catch {
        if (!cancelled) setAccountError("Could not reach MoonVeil.");
      }
    }

    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxChars = account?.plan.maxScriptChars ?? null;
  const overLimit = maxChars !== null && script.length > maxChars;

  async function handleRun() {
    if (!script.trim() || isRunning) return;
    setIsRunning(true);
    setRunError(null);
    setOutput("");

    try {
      const res = await fetch("/api/admin/obf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          script,
          ...(mode === "obf"
            ? {
                options: {
                  compileType,
                  ...(compileType === "vm" ? { vmType } : {}),
                  ...(compileType === "safeEnv" ? { safeEnvLock } : {}),
                  ...(compileType === "cff"
                    ? {
                        cffDecompose,
                        cffMangleNext,
                        cffMangleStrings,
                        cffMangleGlobals,
                        cffMangleCfPercent,
                      }
                    : {}),
                },
              }
            : {}),
        }),
      });

      const json: { output?: string; error?: string; retryAfter?: number } =
        await res.json();

      if (!res.ok) {
        setRunError({ message: json.error ?? "Request failed.", retryAfter: json.retryAfter });
        return;
      }

      setOutput(json.output ?? "");
    } catch {
      setRunError({ message: "Could not reach the server." });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCopy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard denied, nothing to do
    }
  }

  function handleDownload() {
    if (!output) return;
    const extension = mode === "obf" ? "lua" : "txt";
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `symbios-${mode}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.pageTitle}>Obfuscator</h1>
          <p className={styles.pageSubtitle}>
            Proxies the MoonVeil API. The key never reaches the browser.
          </p>
        </div>

        <div className={styles.statusRow}>
          {account ? (
            <>
              <Badge tone="neutral">{account.plan.name}</Badge>
              <span className={styles.usage}>
                {account.usage.used} / {account.usage.quota} today
              </span>
            </>
          ) : accountError ? (
            <span className={styles.error}>{accountError}</span>
          ) : (
            <span className={styles.muted}>Loading account...</span>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              mode === item.value
                ? `${styles.tab} ${styles.tabActive}`
                : styles.tab
            }
            onClick={() => setMode(item.value)}
          >
            {item.label}
          </button>
        ))}

        {mode === "obf" ? (
          <button
            type="button"
            className={styles.gearButton}
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((current) => !current)}
          >
            Options
          </button>
        ) : null}
      </div>

      {mode === "obf" && optionsOpen ? (
        <div className={styles.optionsPanel}>
          <div className={styles.optionGroup}>
            <span className={styles.optionLabel}>Compile type</span>
            <div className={styles.optionChoices}>
              {COMPILE_TYPES.map((value) => (
                <label key={value} className={styles.optionChoice}>
                  <input
                    type="radio"
                    name="compileType"
                    checked={compileType === value}
                    onChange={() => setCompileType(value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          {compileType === "vm" ? (
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>VM type</span>
              <div className={styles.optionChoices}>
                {VM_TYPES.map((value) => (
                  <label key={value} className={styles.optionChoice}>
                    <input
                      type="radio"
                      name="vmType"
                      checked={vmType === value}
                      onChange={() => setVmType(value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {compileType === "safeEnv" ? (
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>Safe env lock</span>
              <div className={styles.optionChoices}>
                {SAFE_ENV_LOCKS.map((value) => (
                  <label key={value} className={styles.optionChoice}>
                    <input
                      type="radio"
                      name="safeEnvLock"
                      checked={safeEnvLock === value}
                      onChange={() => setSafeEnvLock(value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {compileType === "cff" ? (
            <div className={styles.optionGroup}>
              <span className={styles.optionLabel}>CFF options</span>
              <div className={styles.optionChoices}>
                <label className={styles.optionChoice}>
                  <input
                    type="checkbox"
                    checked={cffDecompose}
                    onChange={(event) => setCffDecompose(event.target.checked)}
                  />
                  decompose
                </label>
                <label className={styles.optionChoice}>
                  <input
                    type="checkbox"
                    checked={cffMangleNext}
                    onChange={(event) => setCffMangleNext(event.target.checked)}
                  />
                  mangle next
                </label>
                <label className={styles.optionChoice}>
                  <input
                    type="checkbox"
                    checked={cffMangleStrings}
                    onChange={(event) => setCffMangleStrings(event.target.checked)}
                  />
                  mangle strings
                </label>
                <label className={styles.optionChoice}>
                  <input
                    type="checkbox"
                    checked={cffMangleGlobals}
                    onChange={(event) => setCffMangleGlobals(event.target.checked)}
                  />
                  mangle globals
                </label>
              </div>
              <label className={styles.optionNumberRow}>
                <span>mangle cf percent</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={styles.optionNumber}
                  value={cffMangleCfPercent}
                  onChange={(event) =>
                    setCffMangleCfPercent(Number(event.target.value))
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.editorGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Script</span>
            <span className={overLimit ? styles.counterOver : styles.counter}>
              {script.length}
              {maxChars !== null ? ` / ${maxChars}` : ""}
            </span>
          </div>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck={false}
            placeholder="Paste your Lua script here"
            className={styles.textarea}
          />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Output</span>
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.linkButton}
                disabled={!output}
                onClick={handleCopy}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className={styles.linkButton}
                disabled={!output}
                onClick={handleDownload}
              >
                Download
              </button>
            </div>
          </div>
          <textarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder="Output will appear here"
            className={styles.textarea}
          />
        </div>
      </div>

      {runError ? (
        <p className={styles.error}>
          {runError.message}
          {runError.retryAfter !== undefined
            ? ` Try again in ${runError.retryAfter}s.`
            : ""}
        </p>
      ) : null}

      <div className={styles.actionsRow}>
        <Button
          type="button"
          disabled={isRunning || !script.trim() || overLimit}
          onClick={handleRun}
        >
          {isRunning ? "Running..." : MODES.find((item) => item.value === mode)?.label}
        </Button>
      </div>
    </div>
  );
}
