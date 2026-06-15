"use client";

import { addMonthsKey, monthKey } from "@/lib/dates";
import { useStore } from "@/state/store";

interface ToolbarProps {
  downstreamMode: boolean;
  onToggleDownstream: () => void;
  onAddRound: () => void;
  onCompress: () => void;
  onShare: () => void;
  onShareLink: () => void;
  onExport: () => void;
}

const btn =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-35 disabled:hover:text-ink-soft";

export default function Toolbar({
  downstreamMode,
  onToggleDownstream,
  onAddRound,
  onCompress,
  onShare,
  onShareLink,
  onExport,
}: ToolbarProps) {
  const { project, patch, undo, redo, canUndo, canRedo, syncState } = useStore();
  if (!project) return null;

  return (
    <div className="no-print sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-1.5 bg-paper/90 px-1 py-2 backdrop-blur-sm">
      {/* Month navigation */}
      <div className="flex items-center gap-0.5">
        <button
          className={btn}
          aria-label="Previous month"
          onClick={() => patch((p) => ({ ...p, anchorMonth: addMonthsKey(p.anchorMonth, -1) }))}
        >
          ‹
        </button>
        <button
          className={btn}
          onClick={() => patch((p) => ({ ...p, anchorMonth: monthKey(new Date()) }))}
        >
          Today
        </button>
        <button
          className={btn}
          aria-label="Next month"
          onClick={() => patch((p) => ({ ...p, anchorMonth: addMonthsKey(p.anchorMonth, 1) }))}
        >
          ›
        </button>
      </div>

      {/* Months visible */}
      <div className="flex overflow-hidden rounded-md border border-hairline" role="group" aria-label="Months shown">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            aria-pressed={project.monthsVisible === n}
            className={`px-2.5 py-1.5 text-[12px] font-medium ${
              project.monthsVisible === n
                ? "bg-ink text-paper"
                : "bg-surface text-ink-soft hover:text-ink"
            }`}
            onClick={() => patch((p) => ({ ...p, monthsVisible: n }))}
          >
            {n}M
          </button>
        ))}
      </div>

      <button
        className={btn}
        aria-pressed={project.showLegend}
        onClick={() => patch((p) => ({ ...p, showLegend: !p.showLegend }))}
      >
        Legend
      </button>

      <span className="mx-1 h-5 w-px bg-hairline-strong" />
      <button
        className={`${btn} ${downstreamMode ? "!border-ink !bg-ink !text-paper" : ""}`}
        aria-pressed={downstreamMode}
        title="When on (or while holding Shift during a drag), moving an event also shifts everything after it"
        onClick={onToggleDownstream}
      >
        ⇉ Shift downstream
      </button>
      <button className={btn} onClick={onAddRound}>
        + Review round
      </button>
      <button className={btn} onClick={onCompress}>
        Compress / extend
      </button>
      <span className="mx-1 h-5 w-px bg-hairline-strong" />
      <button className={btn} disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
        ↺
      </button>
      <button className={btn} disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
        ↻
      </button>

      <span className="flex-1" />

      {project.shareId && (
        <span
          className="hidden items-center gap-1 text-[11px] text-ink-faint sm:flex"
          title="This calendar has a shared link — edits sync to everyone who has it"
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
          {syncState === "offline" ? "offline" : syncState === "syncing" ? "syncing…" : "shared"}
        </span>
      )}
      <button className={btn} onClick={onShare} aria-label="Sharing options" title="Sharing options">
        ⋯
      </button>
      <button
        className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper hover:opacity-85"
        onClick={onShareLink}
        title="Publish and send a link anyone can open and edit"
      >
        Share
      </button>
      <button className={btn} onClick={onExport}>
        Export
      </button>
    </div>
  );
}
