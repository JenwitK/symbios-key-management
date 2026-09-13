"use client";

import { useState } from "react";
import styles from "./HwidCell.module.css";

const TRUNCATE_LENGTH = 10;

export function HwidCell({ hwid }: { hwid: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!hwid) {
    return <span>-</span>;
  }

  if (hwid.length <= TRUNCATE_LENGTH + 1) {
    return <span>{hwid}</span>;
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setExpanded((current) => !current)}
      title={expanded ? "Click to hide" : "Click to show the full HWID"}
    >
      {expanded ? hwid : `${hwid.slice(0, TRUNCATE_LENGTH)}…`}
    </button>
  );
}
