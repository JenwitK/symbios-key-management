"use client";

import { useState } from "react";
import styles from "./CodeBlock.module.css";

type CodeBlockProps = {
  filename: string;
  code: string;
};

export function CodeBlock({ filename, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (e.g. insecure context): no-op
    }
  }

  return (
    <div className={styles.block}>
      <div className={styles.titlebar}>
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dotRed} />
          <span className={styles.dotYellow} />
          <span className={styles.dotGreen} />
        </span>
        <span className={styles.filename}>{filename}</span>
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
