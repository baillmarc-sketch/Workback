"use client";

import { CURRENCIES } from "@/lib/estimator/currencies";
import { useEstimate } from "@/state/estimateStore";
import ViewToggle, { type ViewMode } from "./ViewToggle";

interface ToolbarProps {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  onAdjustments: () => void;
  onShare: () => void;
  onExport: () => void;
}

const btn =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-35 disabled:hover:text-ink-soft";

export default function EstimatorToolbar({ mode, onModeChange, onAdjustments, onShare, onExport }: ToolbarProps) {
  const { estimate, commit, undo, redo, canUndo, canRedo, syncState } = useEstimate();
  if (!estimate) return null;

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

      {estimate.shareId && (
        <span
          className="hidden items-center gap-1 text-[11px] text-ink-faint sm:flex"
          title="This estimate is backed up online — edits sync to anyone who has the link"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              syncState === "offline"
                ? "bg-danger"
                : syncState === "syncing"
                  ? "bg-ink-faint"
                  : "bg-[#10B981]"
            }`}
          />
          {syncState === "offline" ? "offline" : syncState === "syncing" ? "syncing…" : "saved"}
        </span>
      )}
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
      <button className={btn} onClick={() => window.print()} title="Print or save as PDF">
        Print / PDF
      </button>
    </div>
  );
}
