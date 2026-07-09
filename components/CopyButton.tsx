"use client";

import { useState } from "react";

export function CopyButton({
  hash = "#quote",
  idleLabel,
  copiedLabel = "Link copied ✓",
  className,
  style,
}: {
  hash?: string;
  idleLabel: string;
  copiedLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href.split("#")[0] + hash);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={copy} className={className} style={style}>
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
