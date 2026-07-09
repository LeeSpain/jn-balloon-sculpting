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
      // Only confirm on a successful write — don't claim "Copied" if it failed.
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked/unsupported — send the user to the link instead.
      location.hash = hash;
    }
  }
  return (
    <button onClick={copy} className={className} style={style} aria-live="polite">
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
