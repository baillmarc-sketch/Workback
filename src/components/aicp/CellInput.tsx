"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An uncontrolled text/number cell that commits on blur or Enter (Escape
 * reverts), so typing doesn't spam the undo history or thrash the store. Resyncs
 * its display when the underlying value changes from elsewhere (undo, sync).
 */
export default function CellInput({
  value,
  onCommit,
  placeholder,
  align = "right",
  className = "",
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  align?: "left" | "right";
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  // Keep the field in sync with external changes, but never clobber an edit.
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          focused.current = false;
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded-sm bg-transparent px-1 py-0.5 outline-none focus:bg-surface focus:ring-1 focus:ring-hairline-strong ${
        align === "right" ? "text-right tabular-nums" : "text-left"
      } ${className}`}
    />
  );
}
