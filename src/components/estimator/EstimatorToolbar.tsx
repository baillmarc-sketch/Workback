"use client";

import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/estimator/currencies";
import { useEstimate } from "@/state/estimateStore";
import ViewToggle, { type ViewMode } from "./ViewToggle";

/** Track the browser's online/offline status so the save indicator can warn
    that edits are held locally until the connection returns. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

interface ToolbarProps {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  onAdjustments: () => void;
  onShare: () => void;
  onExport: () => void;
  onPrint: () => void;
}

const btn =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-35 disabled:hover:text-ink-soft";

export default function EstimatorToolbar({ mode, onModeChange, onAdjustments, onShare, onExport, onPrint }: ToolbarProps) {
  const { estimate, commit, undo, redo, canUndo, canRedo, syncState } = useEstimate();
  const online = useOnline();
  if (!estimate) return null;

  // Status pill — always shown so users know edits are saved (and warned when
  // offline), not just for shared estimates.
  const offline = !online || syncState === "offline";
  const syncing = online && syncState === "syncing";
  const synced = !!estimate.shareId;
  const status = offline
    ? { dot: "bg-danger", text: "offline", title: "You're offline — changes are saved on this device and will sync when you reconnect." }
    : syncing
      ? { dot: "bg-ink-faint", text: "syncing…", title: "Saving your changes online…" }
      : {
          dot: "bg-[#10B981]",
          text: synced ? "synced" : "saved",
          title: synced
            ? "Backed up online — edits sync to anyone who has the link."
            : "Saved on this device (and to your account when signed in).",
        };

  return (
    <div className="no-print sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-1.5 bg-paper/90 px-1 py-2 backdrop-blur-sm">
      <ViewToggle mode={mode} onChange={onModeChange} />

      <span className="mx-1 h-5 w-px bg-hairline-strong" />

      <select
        className={btn}
        value={estimate.currency}
        aria-label="Currency"
        title="Display currency"
        onChange={(e) => commit((est) => ({ ...est, currency: e.target.value }))}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>

      <span className="mx-1 h-5 w-px bg-hairline-strong" />
      <button className={btn} disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
        ↺
      </button>
      <button className={btn} disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
        ↻
      </button>

      <span className="mx-1 h-5 w-px bg-hairline-strong" />
      <button className={btn} onClick={onAdjustments} title="Markup, contingency, insurance, sales tax…">
        Adjustments
      </button>

      <span className="flex-1" />

      <span
        className="flex items-center gap-1 text-[11px] text-ink-faint"
        title={status.title}
        role="status"
        aria-live="polite"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
        {status.text}
      </span>
      <button
        className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper hover:opacity-85"
        onClick={onShare}
        title="Copy a shareable link"
      >
        Share
      </button>
      <button className={btn} onClick={onExport} title="Export to CSV / spreadsheet">
        Export
      </button>
      <button className={btn} onClick={onPrint} title="Export a client-ready PDF">
        Print / PDF
      </button>
    </div>
  );
}
