"use client";

import { useEffect, useState } from "react";
import { useBidSpec } from "@/state/bidSpecsStore";

/** Browser online/offline status for the save indicator. */
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
  onShare: () => void;
  onExport: () => void;
  onPrint: () => void;
  onHelp: () => void;
}

const btn =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-35 disabled:hover:text-ink-soft";

export default function BidSpecsToolbar({ onShare, onExport, onPrint, onHelp }: ToolbarProps) {
  const { spec, undo, redo, canUndo, canRedo, syncState } = useBidSpec();
  const online = useOnline();
  if (!spec) return null;

  const offline = !online || syncState === "offline";
  const syncing = online && syncState === "syncing";
  const synced = !!spec.shareId;
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
      <button className={btn} disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
        ↺
      </button>
      <button className={btn} disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
        ↻
      </button>

      <span className="mx-1 h-5 w-px bg-hairline-strong" />
      <button className={btn} onClick={onHelp} title="AICP bid resources & how it works">
        AICP guides
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
      <button className={btn} onClick={onExport} title="Export to text / CSV">
        Export
      </button>
      <button className={btn} onClick={onPrint} title="Print a clean spec sheet / PDF">
        Print / PDF
      </button>
    </div>
  );
}
